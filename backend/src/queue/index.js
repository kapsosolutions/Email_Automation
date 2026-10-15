import Campaign from '../models/Campaign.js';
import { queueEnabled } from '../config/env.js';
import { releaseStuck } from '../services/dispatcher.js';
import { enqueueCampaign, getQueueCounts, createEmailWorker, closeQueue } from './emailQueue.js';
import { startCampaignInline, isRunning, requestStop, activeCampaignIds } from './inlineRunner.js';
import { pingRedis, closeRedis } from './connection.js';

export const driver = queueEnabled ? 'bullmq' : 'inline';

let inlineWorkerStarted = false;

/**
 * Single entry point used by the API. Hides which driver is active so the
 * controllers never branch on it.
 */
export async function dispatchCampaign(campaignId) {
  // Anything left mid-flight from a previous attempt goes back in the pool.
  await releaseStuck(campaignId);

  if (queueEnabled) {
    const count = await enqueueCampaign(campaignId);
    return { driver: 'bullmq', jobs: count };
  }
  startCampaignInline(campaignId);
  return { driver: 'inline', jobs: null };
}

export function stopCampaign(campaignId) {
  if (!queueEnabled) requestStop(campaignId);
}

/**
 * Campaigns left mid-flight by a restart. With BullMQ the jobs survive in
 * Redis, so only the inline driver needs to re-attach.
 */
export async function resumeInterrupted() {
  // Orphaned in-flight rows are reclaimed under both drivers.
  const released = await releaseStuck();
  if (released) console.log(`[queue] released ${released} in-flight message(s)`);

  if (queueEnabled) return 0;

  const stuck = await Campaign.find({ status: { $in: ['sending', 'queued'] } })
    .select('_id')
    .lean();

  stuck.forEach((campaign) => {
    if (!isRunning(campaign._id)) startCampaignInline(campaign._id);
  });

  if (stuck.length) console.log(`[queue] resumed ${stuck.length} interrupted campaign(s)`);
  return stuck.length;
}

/**
 * Runs the BullMQ worker inside the API process. Convenient for development;
 * in production prefer `npm run worker` as a separate process.
 */
export function startEmbeddedWorker() {
  if (!queueEnabled || inlineWorkerStarted) return null;
  inlineWorkerStarted = true;
  const worker = createEmailWorker();
  if (worker) console.log('[queue] embedded BullMQ worker started');
  return worker;
}

export async function queueHealth() {
  return {
    driver,
    redis: await pingRedis(),
    counts: await getQueueCounts(),
    inlineActive: queueEnabled ? [] : activeCampaignIds(),
  };
}

export async function shutdownQueue() {
  await closeQueue();
  await closeRedis();
}

export default { dispatchCampaign, stopCampaign, resumeInterrupted, queueHealth, driver };
