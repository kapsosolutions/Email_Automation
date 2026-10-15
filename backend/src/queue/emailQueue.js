import { DelayedError, Queue, Worker } from 'bullmq';
import Campaign from '../models/Campaign.js';
import EmailLog from '../models/EmailLog.js';
import env from '../config/env.js';
import { finalizeCampaign, processLog } from '../services/dispatcher.js';
import { getRedis, queueEnabled } from './connection.js';

export const QUEUE_NAME = 'email-send';

let queue = null;

export function getQueue() {
  if (!queueEnabled) return null;
  if (queue) return queue;

  queue = new Queue(QUEUE_NAME, {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 20_000 },
      removeOnComplete: { age: 86_400, count: 5000 },
      removeOnFail: { age: 604_800 },
    },
  });

  return queue;
}

/** Enqueue one job per queued recipient of a campaign. */
export async function enqueueCampaign(campaignId) {
  const target = getQueue();
  if (!target) throw new Error('Queue is not enabled (REDIS_URL is empty)');

  const logs = await EmailLog.find({ campaign: campaignId, status: 'queued' })
    .select('_id')
    .lean();

  const jobs = logs.map((log) => ({
    name: 'send',
    data: { logId: String(log._id), campaignId: String(campaignId) },
    opts: { jobId: `log:${log._id}` },
  }));

  for (let i = 0; i < jobs.length; i += 1000) {
    await target.addBulk(jobs.slice(i, i + 1000));
  }

  return jobs.length;
}

/**
 * Worker factory. The limiter is the deliverability throttle; `concurrency`
 * caps simultaneous SMTP conversations.
 */
export function createEmailWorker() {
  if (!queueEnabled) return null;

  const worker = new Worker(
    QUEUE_NAME,
    async (job, token) => {
      const campaign = await Campaign.findById(job.data.campaignId).select('status').lean();

      if (!campaign || campaign.status === 'cancelled') {
        return { status: 'cancelled' };
      }

      // Hold paused campaigns in the delayed set instead of burning attempts.
      if (campaign.status === 'paused') {
        await job.moveToDelayed(Date.now() + 15_000, token);
        throw new DelayedError();
      }

      const result = await processLog(job.data.logId);
      await finalizeCampaign(job.data.campaignId);
      return result;
    },
    {
      connection: getRedis(),
      concurrency: env.sending.concurrency,
      limiter: { max: env.sending.ratePerMinute, duration: 60_000 },
    },
  );

  worker.on('failed', (job, error) => {
    if (error instanceof DelayedError) return;
    console.error(`[worker] job ${job?.id} failed:`, error?.message);
  });

  return worker;
}

export async function getQueueCounts() {
  const target = getQueue();
  if (!target) return null;
  try {
    return await target.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
  } catch {
    return null;
  }
}

export async function closeQueue() {
  if (queue) {
    await queue.close().catch(() => {});
    queue = null;
  }
}

export { queueEnabled };
export default getQueue;
