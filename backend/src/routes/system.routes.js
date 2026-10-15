import express from 'express';
import mongoose from 'mongoose';
import env, { cloudinaryEnabled, queueEnabled } from '../config/env.js';
import { asyncHandler } from '../middleware/index.js';
import { preflight, getBrevoAccount } from '../services/mailer.js';
import { queueHealth } from '../queue/index.js';

const router = express.Router();

/** GET /api/system/config - non-secret config the frontend can rely on. */
router.get('/config', (req, res) => {
  res.json({
    appName: env.appName,
    publicUrl: env.publicUrl,
    sender: { name: env.mail.fromName, email: env.mail.fromEmail, replyTo: env.mail.replyTo },
    sending: env.sending,
    features: {
      queue: queueEnabled,
      cloudinary: cloudinaryEnabled,
      brevoApi: Boolean(env.brevo.apiKey),
      tracking: true,
    },
    smtp: { host: env.brevo.host, port: env.brevo.port, login: env.brevo.login },
  });
});

/** GET /api/system/smtp-check - live SMTP handshake against the Brevo relay. */
router.get(
  '/smtp-check',
  asyncHandler(async (req, res) => {
    const [relay, account] = await Promise.all([preflight(), getBrevoAccount()]);
    res.json({
      smtp: { ok: relay.ok, via: relay.via, error: relay.error || null },
      reason: relay.reason || null,
      hint: relay.hint || null,
      senderConfigured: Boolean(env.mail.fromEmail),
      account,
    });
  }),
);

/** GET /api/system/health */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    res.json({
      ok: mongoose.connection.readyState === 1,
      uptimeSeconds: Math.round(process.uptime()),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      queue: await queueHealth(),
      env: env.nodeEnv,
    });
  }),
);

export default router;
