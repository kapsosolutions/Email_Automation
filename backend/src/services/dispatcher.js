import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import Contact from '../models/Contact.js';
import EmailLog from '../models/EmailLog.js';
import Template from '../models/Template.js';
import env from '../config/env.js';
import { newTrackId } from '../utils/signature.js';
import { composeMessage } from './templateEngine.js';
import { sendMailResilient } from './mailer.js';

const CHUNK = 500;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create one queued EmailLog per eligible recipient.
 *
 * Eligibility rules applied here are the list-hygiene half of inbox
 * placement: never mail an address that unsubscribed, never mail one that
 * previously hard-bounced, never mail the same address twice in one campaign.
 */
export async function materializeRecipients(campaignId) {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw Object.assign(new Error('Campaign not found'), { status: 404 });

  // Addresses that opted out anywhere in the account are suppressed globally.
  const suppressed = new Set(
    (
      await Contact.find({ status: { $in: ['unsubscribed', 'bounced'] } })
        .select('email')
        .lean()
    ).map((contact) => contact.email),
  );

  const cursor = Contact.find({ list: campaign.list, status: 'subscribed' })
    .sort({ rowNumber: 1 })
    .lean()
    .cursor();

  const seen = new Set();
  let batch = [];
  let total = 0;
  let skipped = 0;

  const flush = async () => {
    if (!batch.length) return;
    await EmailLog.insertMany(batch, { ordered: false });
    batch = [];
  };

  for await (const contact of cursor) {
    if (seen.has(contact.email)) continue;
    seen.add(contact.email);

    if (suppressed.has(contact.email)) {
      skipped += 1;
      batch.push({
        campaign: campaign._id,
        contact: contact._id,
        list: campaign.list,
        email: contact.email,
        subject: campaign.subject,
        status: 'skipped',
        trackId: newTrackId(),
        error: 'Recipient is unsubscribed or previously bounced',
      });
    } else {
      total += 1;
      batch.push({
        campaign: campaign._id,
        contact: contact._id,
        list: campaign.list,
        email: contact.email,
        subject: campaign.subject,
        status: 'queued',
        trackId: newTrackId(),
      });
    }

    if (batch.length >= CHUNK) await flush();
  }
  await flush();

  campaign.stats.total = total + skipped;
  campaign.stats.queued = total;
  campaign.stats.skipped = skipped;
  await campaign.save();

  return { total, skipped };
}

/**
 * Send a single queued log entry. Safe to call concurrently and idempotent.
 *
 * The claim moves the row from `queued` to `sending` in one atomic operation.
 * That transition is the lock: a second worker that reaches the same row finds
 * it is no longer `queued` and backs off, so no address is ever mailed twice
 * and the campaign counters are only incremented once per recipient.
 */
export async function processLog(logId) {
  const log = await EmailLog.findOneAndUpdate(
    { _id: logId, status: 'queued' },
    { $set: { status: 'sending' }, $inc: { attempts: 1 } },
    { new: true },
  );
  if (!log) return { status: 'already-handled' };

  const [campaign, contact] = await Promise.all([
    Campaign.findById(log.campaign).lean(),
    Contact.findById(log.contact).lean(),
  ]);

  if (!campaign) {
    await EmailLog.updateOne({ _id: log._id }, { status: 'failed', error: 'Campaign missing' });
    return { status: 'failed' };
  }

  if (campaign.status === 'cancelled') {
    await EmailLog.updateOne({ _id: log._id }, { status: 'skipped', error: 'Campaign cancelled' });
    await Campaign.updateOne(
      { _id: campaign._id },
      { $inc: { 'stats.skipped': 1, 'stats.queued': -1 } },
    );
    return { status: 'cancelled' };
  }

  if (!contact || contact.status !== 'subscribed') {
    await EmailLog.updateOne(
      { _id: log._id },
      { status: 'skipped', error: contact ? `Recipient is ${contact.status}` : 'Contact missing' },
    );
    await Campaign.updateOne(
      { _id: campaign._id },
      { $inc: { 'stats.skipped': 1, 'stats.queued': -1 } },
    );
    return { status: 'skipped' };
  }

  const message = composeMessage({
    template: {
      subject: campaign.subject,
      html: campaign.html,
      preheader: campaign.preheader,
      fromName: campaign.fromName,
    },
    contact,
    trackId: log.trackId,
    defaults: campaign.defaults || {},
  });

  try {
    const result = await sendMailResilient({
      to: contact.email,
      toName: contact.name || '',
      subject: message.subject,
      html: message.html,
      text: message.text,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
      replyTo: campaign.replyTo,
      unsubscribeUrl: message.unsubscribeUrl,
      campaignId: String(campaign._id),
    });

    await Promise.all([
      EmailLog.updateOne(
        { _id: log._id },
        {
          status: 'sent',
          subject: message.subject,
          messageId: result.messageId || '',
          sentAt: new Date(),
          error: '',
        },
      ),
      Campaign.updateOne(
        { _id: campaign._id },
        { $inc: { 'stats.sent': 1, 'stats.queued': -1 } },
      ),
      Contact.updateOne(
        { _id: contact._id },
        { $set: { lastSentAt: new Date() }, $inc: { sendCount: 1 } },
      ),
    ]);

    return { status: 'sent', messageId: result.messageId };
  } catch (error) {
    await Promise.all([
      EmailLog.updateOne(
        { _id: log._id },
        {
          status: 'failed',
          // Keep the rendered subject even on failure so the log reflects what
          // we actually tried to send, not the raw template.
          subject: message.subject,
          error: String(error.message || error).slice(0, 500),
        },
      ),
      Campaign.updateOne(
        { _id: campaign._id },
        { $inc: { 'stats.failed': 1, 'stats.queued': -1 } },
      ),
    ]);
    return { status: 'failed', error: error.message };
  }
}

/** Recount a campaign's stats straight from its logs - the source of truth. */
export async function reconcileStats(campaignId) {
  const rows = await EmailLog.aggregate([
    { $match: { campaign: new mongoose.Types.ObjectId(String(campaignId)) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        opened: { $sum: { $cond: [{ $gt: ['$opens', 0] }, 1, 0] } },
        clicked: { $sum: { $cond: [{ $gt: ['$clicks', 0] }, 1, 0] } },
        unsubscribed: { $sum: { $cond: [{ $ne: ['$unsubscribedAt', null] }, 1, 0] } },
      },
    },
  ]);

  const byStatus = Object.fromEntries(rows.map((row) => [row._id, row.count]));
  const sum = (key) => rows.reduce((total, row) => total + (row[key] || 0), 0);

  const stats = {
    total: rows.reduce((total, row) => total + row.count, 0),
    queued: (byStatus.queued || 0) + (byStatus.sending || 0),
    sent: byStatus.sent || 0,
    failed: byStatus.failed || 0,
    skipped: byStatus.skipped || 0,
    opened: sum('opened'),
    clicked: sum('clicked'),
    unsubscribed: sum('unsubscribed'),
  };

  await Campaign.updateOne({ _id: campaignId }, { $set: { stats } });
  return stats;
}

/** Flip a campaign to completed/failed once nothing is left in flight. */
export async function finalizeCampaign(campaignId) {
  const remaining = await EmailLog.countDocuments({
    campaign: campaignId,
    status: { $in: ['queued', 'sending'] },
  });
  if (remaining > 0) return null;

  const campaign = await Campaign.findById(campaignId);
  if (!campaign || ['completed', 'cancelled'].includes(campaign.status)) return campaign;

  // Incremental counters can drift if a process dies mid-update; the final
  // recount makes the stored numbers match the log table exactly.
  const stats = await reconcileStats(campaignId);
  campaign.stats = stats;

  const nothingSent = stats.sent === 0 && stats.failed > 0;
  campaign.status = nothingSent ? 'failed' : 'completed';
  campaign.completedAt = new Date();
  if (nothingSent && !campaign.error) campaign.error = 'Every message failed to send.';
  await campaign.save();

  if (campaign.template) {
    await Template.updateOne(
      { _id: campaign.template },
      { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } },
    );
  }

  return campaign;
}

/**
 * A slot scheduler that converts "N messages per minute" into timestamps.
 * Shared by both drivers so the throttle behaves identically whether or not
 * Redis is configured.
 */
export function createPacer(ratePerMinute) {
  const interval = Math.max(0, Math.floor(60_000 / Math.max(1, ratePerMinute)));
  let next = Date.now();
  return async function wait() {
    const jitter = env.sending.jitterMs ? Math.floor(Math.random() * env.sending.jitterMs) : 0;
    const now = Date.now();
    const slot = Math.max(now, next);
    next = slot + interval;
    const delay = slot - now + jitter;
    if (delay > 0) await sleep(delay);
  };
}

/**
 * Return rows orphaned in `sending` by a crashed process back to `queued`.
 * Called on boot and before a resume, so a restart never strands a campaign.
 */
export async function releaseStuck(campaignId) {
  const filter = { status: 'sending' };
  if (campaignId) filter.campaign = campaignId;
  const result = await EmailLog.updateMany(filter, { $set: { status: 'queued' } });
  return result.modifiedCount || 0;
}

export default {
  materializeRecipients,
  processLog,
  finalizeCampaign,
  reconcileStats,
  releaseStuck,
  createPacer,
  sleep,
};
