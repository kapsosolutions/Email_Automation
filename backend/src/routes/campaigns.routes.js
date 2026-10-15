import express from 'express';
import Campaign from '../models/Campaign.js';
import Contact from '../models/Contact.js';
import ContactList from '../models/ContactList.js';
import EmailLog from '../models/EmailLog.js';
import Template from '../models/Template.js';
import env from '../config/env.js';
import { asyncHandler, badRequest, HttpError, notFound } from '../middleware/index.js';
import { dispatchCampaign, driver, stopCampaign } from '../queue/index.js';
import { materializeRecipients, reconcileStats } from '../services/dispatcher.js';
import { preflight, sendMailResilient } from '../services/mailer.js';
import { composeMessage, extractPlaceholders, findUnmatchedPlaceholders } from '../services/templateEngine.js';
import { isValidEmail, normalizeEmail } from '../utils/email.js';
import { newTrackId } from '../utils/signature.js';

const router = express.Router();

/** Percentage of the recipient set that has reached a terminal state. */
const progressOf = (campaign) => {
  const stats = campaign?.stats || {};
  const done = (stats.sent || 0) + (stats.failed || 0) + (stats.skipped || 0);
  if (!stats.total) return 0;
  return Math.min(100, Math.max(0, Math.round((done / stats.total) * 100)));
};

/**
 * POST /api/campaigns/send
 * The one call the Send page makes: pick a list, pick a template, go.
 *
 * Body: {
 *   name?, listId, templateId?,
 *   subject?, html?, preheader?,        // inline template instead of templateId
 *   fromName?, fromEmail?, replyTo?,
 *   defaults?, ratePerMinute?, allowUnmatched?
 * }
 */
router.post(
  '/send',
  asyncHandler(async (req, res) => {
    const {
      name,
      listId,
      templateId,
      defaults = {},
      ratePerMinute,
      allowUnmatched = false,
    } = req.body;

    if (!listId) throw badRequest('Choose a contact list.');

    const list = await ContactList.findById(listId).lean();
    if (!list) throw notFound('List not found');

    let source;
    if (templateId) {
      const template = await Template.findById(templateId).lean();
      if (!template) throw notFound('Template not found');
      source = template;
    } else {
      source = {
        subject: req.body.subject,
        html: req.body.html,
        preheader: req.body.preheader,
        fromName: req.body.fromName,
        fromEmail: req.body.fromEmail,
        replyTo: req.body.replyTo,
        defaults,
      };
    }

    const subject = (req.body.subject ?? source.subject ?? '').trim();
    const html = req.body.html ?? source.html ?? '';
    if (!subject) throw badRequest('Subject is required.');
    if (!html.trim()) throw badRequest('The email body is empty.');

    const fromEmail = normalizeEmail(req.body.fromEmail || source.fromEmail || env.mail.fromEmail);
    if (!fromEmail || !isValidEmail(fromEmail)) {
      throw badRequest(
        'No valid sender address. Set MAIL_FROM_EMAIL in backend/.env or pass fromEmail, using a domain authenticated in Brevo.',
      );
    }

    const mergedDefaults = { ...(source.defaults || {}), ...defaults };
    const placeholders = extractPlaceholders(subject, req.body.preheader ?? source.preheader, html);
    const unmatched = findUnmatchedPlaceholders(placeholders, list.columns || [], mergedDefaults);

    // Refuse by default rather than mailing a visible "{company}" to everyone.
    if (unmatched.length && !allowUnmatched) {
      throw badRequest(
        `These placeholders have no matching column in "${list.name}": ${unmatched.join(', ')}`,
        { unmatched, columns: list.columns, hint: 'Add a default value, rename the placeholder, or resend with allowUnmatched=true.' },
      );
    }

    const recipientCount = await Contact.countDocuments({ list: list._id, status: 'subscribed' });
    if (!recipientCount) throw badRequest('That list has no subscribed contacts left to mail.');

    // Fail fast on an account-level problem instead of marking every recipient
    // failed one at a time, which makes it look like the addresses were bad.
    const relay = await preflight();
    if (!relay.ok) {
      throw new HttpError(
        503,
        `Brevo refused the connection, so nothing was sent: ${relay.error}`,
        relay.hint ? [relay.hint] : undefined,
      );
    }

    const campaign = await Campaign.create({
      name: (name || '').trim() || `${subject} — ${new Date().toLocaleDateString('en-GB')}`,
      template: templateId || undefined,
      list: list._id,
      subject,
      html,
      preheader: req.body.preheader ?? source.preheader ?? '',
      fromName: req.body.fromName || source.fromName || env.mail.fromName,
      fromEmail,
      replyTo: normalizeEmail(req.body.replyTo || source.replyTo || env.mail.replyTo || fromEmail),
      placeholders,
      defaults: mergedDefaults,
      status: 'queued',
      driver,
      ratePerMinute: Number(ratePerMinute) > 0 ? Number(ratePerMinute) : env.sending.ratePerMinute,
      startedAt: new Date(),
    });

    const { total, skipped } = await materializeRecipients(campaign._id);

    campaign.status = 'sending';
    await campaign.save();

    const dispatched = await dispatchCampaign(campaign._id);

    res.status(202).json({
      campaign: await Campaign.findById(campaign._id).lean(),
      queued: total,
      suppressed: skipped,
      driver: dispatched.driver,
      unmatchedPlaceholders: unmatched,
      message: `Sending ${total} message(s) at ${campaign.ratePerMinute}/minute via ${dispatched.driver}.`,
    });
  }),
);

/**
 * POST /api/campaigns/test
 * Send one message to yourself before committing to the list. Rendered with a
 * real row from the list so placeholder substitution is proven end to end.
 */
router.post(
  '/test',
  asyncHandler(async (req, res) => {
    const { to, templateId, listId, contactId } = req.body;
    const recipient = normalizeEmail(to);
    if (!isValidEmail(recipient)) throw badRequest('Enter a valid test recipient address.');

    let source = {};
    if (templateId) {
      const template = await Template.findById(templateId).lean();
      if (!template) throw notFound('Template not found');
      source = template;
    }

    const subject = (req.body.subject ?? source.subject ?? '').trim();
    const html = req.body.html ?? source.html ?? '';
    if (!subject || !html.trim()) throw badRequest('Subject and body are required.');

    let contact = null;
    if (contactId) contact = await Contact.findById(contactId).lean();
    else if (listId) contact = await Contact.findOne({ list: listId }).sort({ rowNumber: 1 }).lean();

    const sampleData = contact?.data || { name: 'Alex Morgan', email: recipient };
    const trackId = newTrackId();

    const message = composeMessage({
      template: {
        subject,
        html,
        preheader: req.body.preheader ?? source.preheader ?? '',
        fromName: req.body.fromName || source.fromName || env.mail.fromName,
      },
      contact: { email: recipient, name: contact?.name || sampleData.name || '', data: sampleData },
      trackId,
      defaults: { ...(source.defaults || {}), ...(req.body.defaults || {}) },
    });

    const fromEmail = normalizeEmail(req.body.fromEmail || source.fromEmail || env.mail.fromEmail);
    if (!isValidEmail(fromEmail)) throw badRequest('No valid sender address configured.');

    const relay = await preflight();
    if (!relay.ok) {
      throw new HttpError(
        503,
        `Brevo refused the connection, so the test was not sent: ${relay.error}`,
        relay.hint ? [relay.hint] : undefined,
      );
    }

    const result = await sendMailResilient({
      to: recipient,
      toName: contact?.name || '',
      subject: `${message.subject}`,
      html: message.html,
      text: message.text,
      fromName: req.body.fromName || source.fromName || env.mail.fromName,
      fromEmail,
      replyTo: req.body.replyTo || source.replyTo || env.mail.replyTo,
      unsubscribeUrl: message.unsubscribeUrl,
      campaignId: 'test',
    });

    res.json({
      sent: true,
      to: recipient,
      subject: message.subject,
      messageId: result.messageId,
      viaApiFallback: Boolean(result.fallback),
      renderedWith: sampleData,
    });
  }),
);

/** GET /api/campaigns */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = req.query.status ? { status: req.query.status } : {};

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('list', 'name')
        .populate('template', 'name')
        .lean(),
      Campaign.countDocuments(filter),
    ]);

    res.json({
      campaigns: campaigns.map((campaign) => ({ ...campaign, progress: progressOf(campaign) })),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  }),
);

/** GET /api/campaigns/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id)
      .populate('list', 'name columns emailColumn')
      .populate('template', 'name')
      .lean();
    if (!campaign) throw notFound('Campaign not found');

    res.json({ ...campaign, progress: progressOf(campaign) });
  }),
);

/** GET /api/campaigns/:id/logs */
router.get(
  '/:id/logs',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const filter = { campaign: req.params.id };
    if (req.query.status) filter.status = req.query.status;

    const [logs, total] = await Promise.all([
      EmailLog.find(filter)
        .sort({ sentAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('email status subject messageId opens clicks error sentAt firstOpenedAt unsubscribedAt')
        .lean(),
      EmailLog.countDocuments(filter),
    ]);

    res.json({ logs, page, limit, total, pages: Math.ceil(total / limit) });
  }),
);

const setStatus = (allowedFrom, next, label) =>
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) throw notFound('Campaign not found');
    if (!allowedFrom.includes(campaign.status)) {
      throw badRequest(`Cannot ${label} a campaign that is "${campaign.status}".`);
    }

    campaign.status = next;
    if (next === 'cancelled') campaign.completedAt = new Date();
    await campaign.save();

    if (next === 'cancelled') stopCampaign(campaign._id);
    if (next === 'sending') await dispatchCampaign(campaign._id);

    res.json({ campaign: campaign.toJSON() });
  });

router.post('/:id/pause', setStatus(['sending', 'queued'], 'paused', 'pause'));
router.post('/:id/resume', setStatus(['paused'], 'sending', 'resume'));
router.post('/:id/cancel', setStatus(['sending', 'queued', 'paused'], 'cancelled', 'cancel'));

/** POST /api/campaigns/:id/retry-failed - requeue the failures only. */
router.post(
  '/:id/retry-failed',
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) throw notFound('Campaign not found');
    if (['sending', 'queued'].includes(campaign.status)) {
      throw badRequest('Campaign is still running.');
    }

    const failed = await EmailLog.countDocuments({ campaign: campaign._id, status: 'failed' });
    if (!failed) throw badRequest('No failed messages to retry.');

    await EmailLog.updateMany(
      { campaign: campaign._id, status: 'failed' },
      { $set: { status: 'queued', error: '' } },
    );

    await Campaign.updateOne(
      { _id: campaign._id },
      { $set: { status: 'sending', completedAt: null, error: '' } },
    );
    await reconcileStats(campaign._id);

    const dispatched = await dispatchCampaign(campaign._id);
    res.json({ retrying: failed, driver: dispatched.driver });
  }),
);

/** DELETE /api/campaigns/:id */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) throw notFound('Campaign not found');
    if (['sending', 'queued'].includes(campaign.status)) {
      throw badRequest('Cancel the campaign before deleting it.');
    }
    await EmailLog.deleteMany({ campaign: campaign._id });
    await campaign.deleteOne();
    res.json({ deleted: true, id: req.params.id });
  }),
);

export default router;
