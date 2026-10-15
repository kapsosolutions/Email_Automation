/**
 * Standalone BullMQ worker: `npm run worker`
 *
 * Run one or more of these alongside the API when REDIS_URL is set, so a
 * long campaign is not competing with HTTP traffic for the event loop.
 */
import connectDB from '../config/db.js';
import env, { queueEnabled } from '../config/env.js';
import { createEmailWorker } from './emailQueue.js';
import { closeRedis } from './connection.js';
import { verifyConnection, closeTransporter } from '../services/mailer.js';

async function main() {
  if (!queueEnabled) {
    console.error('[worker] REDIS_URL is empty - the API handles sending inline, no worker needed.');
    process.exit(1);
  }

  await connectDB();

  const smtp = await verifyConnection();
  console.log(
    smtp.ok
      ? `[worker] SMTP ready (${env.brevo.host}:${env.brevo.port})`
      : `[worker] SMTP check failed: ${smtp.error}`,
  );

  const worker = createEmailWorker();
  console.log(
    `[worker] listening | concurrency=${env.sending.concurrency} rate=${env.sending.ratePerMinute}/min`,
  );

  const shutdown = async (signal) => {
    console.log(`[worker] ${signal} received, draining...`);
    await worker?.close();
    closeTransporter();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[worker] fatal:', error);
  process.exit(1);
});
