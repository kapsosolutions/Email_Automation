import app from './app.js';
import connectDB from './config/db.js';
import env, { cloudinaryEnabled, queueEnabled } from './config/env.js';
import { driver, resumeInterrupted, shutdownQueue, startEmbeddedWorker } from './queue/index.js';
import { closeTransporter, verifyConnection } from './services/mailer.js';

async function bootstrap() {
  await connectDB();

  const server = app.listen(env.port, () => {
    console.log('');
    console.log(`  ${env.appName} API`);
    console.log(`  http://localhost:${env.port}`);
    console.log(`  env        ${env.nodeEnv}`);
    console.log(`  dispatcher ${driver}${queueEnabled ? ' (Redis)' : ' (in-process)'}`);
    console.log(`  cloudinary ${cloudinaryEnabled ? 'on' : 'off'}`);
    console.log(`  rate       ${env.sending.ratePerMinute}/min, concurrency ${env.sending.concurrency}`);
    console.log('');
  });

  // Non-blocking: report the relay state but never stop the API from booting.
  verifyConnection().then((result) => {
    console.log(
      result.ok
        ? `[smtp] Brevo relay ready (${env.brevo.host}:${env.brevo.port})`
        : `[smtp] relay check failed: ${result.error}`,
    );
    if (!env.mail.fromEmail) {
      console.warn('[smtp] MAIL_FROM_EMAIL is empty - set an authenticated sender before sending.');
    }
  });

  startEmbeddedWorker();
  resumeInterrupted().catch((error) => console.error('[queue] resume failed:', error.message));

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down`);
    server.close();
    closeTransporter();
    await shutdownQueue();
    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
}

bootstrap().catch((error) => {
  console.error('[server] failed to start:', error.message);
  process.exit(1);
});
