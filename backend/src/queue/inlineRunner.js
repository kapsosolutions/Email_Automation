import Campaign from '../models/Campaign.js';
import EmailLog from '../models/EmailLog.js';
import env from '../config/env.js';
import { createPacer, finalizeCampaign, processLog, sleep } from '../services/dispatcher.js';

/**
 * In-process fallback for when Redis is not configured.
 *
 * Same pacing and the same per-recipient `processLog` call as the BullMQ
 * worker, so behaviour does not change between drivers. The trade-off is
 * durability: a process restart mid-campaign leaves logs in `queued`, which
 * `resumeInterrupted` picks back up on boot.
 */
const running = new Map(); // campaignId -> { cancelled }

export function isRunning(campaignId) {
  return running.has(String(campaignId));
}

export function activeCampaignIds() {
  return [...running.keys()];
}

export function requestStop(campaignId) {
  const state = running.get(String(campaignId));
  if (state) state.cancelled = true;
}

async function claimNext(campaignId) {
  return EmailLog.findOne({ campaign: campaignId, status: 'queued' }).select('_id').lean();
}

async function lane(campaignId, pacer, state) {
  for (;;) {
    if (state.cancelled) return;

    const campaign = await Campaign.findById(campaignId).select('status').lean();
    if (!campaign || ['cancelled', 'completed'].includes(campaign.status)) return;

    if (campaign.status === 'paused') {
      await sleep(3000);
      continue;
    }

    const next = await claimNext(campaignId);
    if (!next) return;

    await pacer();
    if (state.cancelled) return;

    try {
      await processLog(next._id);
    } catch (error) {
      console.error('[inline] send error:', error.message);
    }
  }
}

export async function runCampaignInline(campaignId) {
  const key = String(campaignId);
  if (running.has(key)) return { alreadyRunning: true };

  const state = { cancelled: false };
  running.set(key, state);

  const campaign = await Campaign.findById(campaignId).select('ratePerMinute').lean();
  const pacer = createPacer(campaign?.ratePerMinute || env.sending.ratePerMinute);
  const lanes = Array.from({ length: Math.max(1, env.sending.concurrency) }, () =>
    lane(campaignId, pacer, state),
  );

  try {
    await Promise.all(lanes);
    await finalizeCampaign(campaignId);
  } catch (error) {
    console.error('[inline] campaign error:', error.message);
    await Campaign.updateOne(
      { _id: campaignId },
      { status: 'failed', error: String(error.message).slice(0, 500) },
    );
  } finally {
    running.delete(key);
  }

  return { done: true };
}

/** Fire and forget - the HTTP request that started the campaign returns at once. */
export function startCampaignInline(campaignId) {
  runCampaignInline(campaignId).catch((error) =>
    console.error('[inline] unhandled:', error.message),
  );
}

export default { runCampaignInline, startCampaignInline, isRunning, requestStop, activeCampaignIds };
