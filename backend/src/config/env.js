import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const list = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const env = {
  port: num(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'Email Automation',
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:5000').replace(/\/+$/, ''),
  corsOrigins: list(process.env.CORS_ORIGIN).length
    ? list(process.env.CORS_ORIGIN)
    : ['http://localhost:5173'],

  mongoUri: process.env.MONGO_URI || '',

  brevo: {
    host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
    port: num(process.env.BREVO_SMTP_PORT, 587),
    login: process.env.BREVO_SMTP_LOGIN || '',
    smtpKey: process.env.BREVO_SMTP_KEY || '',
    apiKey: process.env.BREVO_API_KEY || '',
  },

  mail: {
    fromName: process.env.MAIL_FROM_NAME || 'Email Automation',
    fromEmail: process.env.MAIL_FROM_EMAIL || '',
    replyTo: process.env.MAIL_REPLY_TO || '',
  },

  sending: {
    ratePerMinute: num(process.env.SEND_RATE_PER_MINUTE, 60),
    concurrency: num(process.env.SEND_CONCURRENCY, 3),
    jitterMs: num(process.env.SEND_JITTER_MS, 400),
  },

  redisUrl: process.env.REDIS_URL || '',

  cloudinary: {
    cloudName: process.env.CLOUDINARY_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  trackingSecret: process.env.TRACKING_SECRET || 'insecure-dev-secret',
};

export const queueEnabled = Boolean(env.redisUrl);
export const cloudinaryEnabled = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret,
);

export default env;
