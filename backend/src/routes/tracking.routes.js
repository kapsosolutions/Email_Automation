import express from 'express';
import Campaign from '../models/Campaign.js';
import Contact from '../models/Contact.js';
import EmailLog from '../models/EmailLog.js';
import env from '../config/env.js';
import { asyncHandler } from '../middleware/index.js';
import { decodeUrl, verify } from '../utils/signature.js';

const router = express.Router();

// 1x1 transparent GIF. Smaller than a PNG and universally rendered.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

const sendPixel = (res) => {
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': String(PIXEL.length),
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.end(PIXEL);
};

/** Every tracking payload is HMAC-signed; an unsigned hit is ignored. */
const authorized = (req, trackId) => verify(trackId, req.query.s);

/**
 * GET /t/o/:file  (file is "<trackId>.png")
 * Open pixel. Always answers with an image, even on a bad signature, so a
 * broken link never shows a missing-image icon in the recipient's client.
 */
router.get(
  '/o/:file',
  asyncHandler(async (req, res) => {
    const trackId = String(req.params.file).replace(/\.(png|gif|jpg)$/i, '');

    if (!authorized(req, trackId)) {
      sendPixel(res);
      return;
    }

    // `new: false` returns the pre-update document, which is how we tell a
    // first open from a repeat one.
    const log = await EmailLog.findOneAndUpdate({ trackId }, { $inc: { opens: 1 } }, { new: false });

    if (log && !log.firstOpenedAt) {
      await EmailLog.updateOne({ trackId }, { $set: { firstOpenedAt: new Date() } });
      if (log.campaign) {
        await Campaign.updateOne({ _id: log.campaign }, { $inc: { 'stats.opened': 1 } });
      }
    }

    sendPixel(res);
  }),
);

/**
 * GET /t/c/:trackId?u=<base64url>
 * Click redirect. The destination is only honoured when the signature checks
 * out, which is what stops this being an open redirect.
 */
router.get(
  '/c/:trackId',
  asyncHandler(async (req, res) => {
    const { trackId } = req.params;

    if (!authorized(req, trackId) || !req.query.u) {
      res.redirect(302, env.publicUrl);
      return;
    }

    let target;
    try {
      target = new URL(decodeUrl(req.query.u));
    } catch {
      res.redirect(302, env.publicUrl);
      return;
    }
    if (!['http:', 'https:'].includes(target.protocol)) {
      res.redirect(302, env.publicUrl);
      return;
    }

    const log = await EmailLog.findOneAndUpdate(
      { trackId },
      { $inc: { clicks: 1 }, $set: { lastClickedAt: new Date() } },
      { new: false },
    );

    if (log && log.clicks === 0 && log.campaign) {
      await Campaign.updateOne({ _id: log.campaign }, { $inc: { 'stats.clicked': 1 } });
    }
    // A click implies an open even when images were blocked.
    if (log && !log.firstOpenedAt) {
      await EmailLog.updateOne({ trackId }, { $set: { firstOpenedAt: new Date() }, $inc: { opens: 1 } });
      if (log.campaign) {
        await Campaign.updateOne({ _id: log.campaign }, { $inc: { 'stats.opened': 1 } });
      }
    }

    res.redirect(302, target.toString());
  }),
);

async function applyUnsubscribe(trackId) {
  const log = await EmailLog.findOne({ trackId });
  if (!log) return null;

  if (!log.unsubscribedAt) {
    log.unsubscribedAt = new Date();
    await log.save();

    // Suppress the address everywhere, not just on this one list.
    await Contact.updateMany(
      { email: log.email, status: { $ne: 'unsubscribed' } },
      { $set: { status: 'unsubscribed', unsubscribedAt: new Date() } },
    );

    if (log.campaign) {
      await Campaign.updateOne({ _id: log.campaign }, { $inc: { 'stats.unsubscribed': 1 } });
    }
  }

  return log;
}

const page = (title, message, tone = '#1a73e8') => `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body{margin:0;background:#ffffff;font-family:'Google Sans Text',Arial,Helvetica,sans-serif;color:#202124;}
  .wrap{max-width:560px;margin:0 auto;padding:80px 24px;}
  h1{font-family:'Google Sans',Arial,sans-serif;font-size:36px;font-weight:400;line-height:44px;letter-spacing:-0.25px;margin:0 0 16px;}
  p{font-size:18px;line-height:28px;color:#5f6368;margin:0 0 24px;}
  .card{border:1px solid #dadce0;border-radius:4px;padding:32px;}
  .rule{height:4px;width:48px;background:${tone};border-radius:4px;margin:0 0 24px;}
</style>
</head><body><div class="wrap"><div class="card">
<div class="rule"></div>
<h1>${title}</h1><p>${message}</p>
</div></div></body></html>`;

/**
 * POST /t/u/:trackId
 * One-click unsubscribe target for the List-Unsubscribe-Post header. Gmail and
 * Yahoo POST here directly, with no human in the loop.
 */
router.post(
  '/u/:trackId',
  asyncHandler(async (req, res) => {
    if (!authorized(req, req.params.trackId)) {
      res.status(400).send('Invalid unsubscribe link');
      return;
    }
    await applyUnsubscribe(req.params.trackId);
    res.status(200).send('OK');
  }),
);

/** GET /t/u/:trackId - the human-facing confirmation page. */
router.get(
  '/u/:trackId',
  asyncHandler(async (req, res) => {
    if (!authorized(req, req.params.trackId)) {
      res.status(400).send(
        page('Link not valid', 'This unsubscribe link is incomplete or has been altered.', '#ea4335'),
      );
      return;
    }

    const log = await applyUnsubscribe(req.params.trackId);
    if (!log) {
      res.status(404).send(page('Not found', 'We could not find that subscription.', '#ea4335'));
      return;
    }

    res.send(
      page(
        'You are unsubscribed',
        `<strong>${log.email}</strong> has been removed from our mailing list and will not receive further campaigns.`,
      ),
    );
  }),
);

export default router;
