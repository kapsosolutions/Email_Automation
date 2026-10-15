import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import env from '../config/env.js';
import { formatAddress } from '../utils/email.js';

/**
 * Brevo SMTP relay transport.
 *
 * Pooled and rate-limited on purpose: receiving MTAs (especially Gmail and
 * Outlook) treat a burst of identical messages from a young sending domain as
 * a spam signal. `rateDelta`/`rateLimit` spread the campaign out instead.
 */
let transporter = null;

export function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.brevo.host,
    port: env.brevo.port,
    secure: env.brevo.port === 465,
    requireTLS: env.brevo.port === 587,
    auth: {
      user: env.brevo.login,
      pass: env.brevo.smtpKey,
    },
    pool: true,
    maxConnections: Math.max(1, env.sending.concurrency),
    maxMessages: 100,
    rateDelta: 60_000,
    rateLimit: Math.max(1, env.sending.ratePerMinute),
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  return transporter;
}

export async function verifyConnection() {
  if (!env.brevo.login || !env.brevo.smtpKey) {
    return { ok: false, error: 'BREVO_SMTP_LOGIN / BREVO_SMTP_KEY are not configured' };
  }
  try {
    await getTransporter().verify();
    return { ok: true, host: env.brevo.host, port: env.brevo.port };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

const domainOf = (email) => String(email || '').split('@')[1] || 'localhost';

/**
 * Headers that decide inbox vs spam:
 *  - List-Unsubscribe + One-Click: required by Gmail/Yahoo bulk sender rules
 *    (Feb 2024) for anyone sending over 5k/day, and trusted by filters below
 *    that threshold too.
 *  - Message-ID anchored to the sending domain keeps DKIM alignment tidy.
 *  - X-Entity-Ref-ID stops Gmail collapsing near-identical mail into one
 *    thread with a "trimmed content" notice.
 *  - Precedence: bulk tells well-behaved autoresponders not to reply.
 */
function buildHeaders({ unsubscribeUrl, replyTo, campaignId, fromEmail }) {
  const headers = {
    'X-Entity-Ref-ID': crypto.randomUUID(),
    'X-Mailer': `${env.appName} (Brevo relay)`,
    Precedence: 'bulk',
    'Auto-Submitted': 'auto-generated',
  };

  if (unsubscribeUrl) {
    const parts = [`<${unsubscribeUrl}>`];
    if (replyTo) parts.unshift(`<mailto:${replyTo}?subject=unsubscribe>`);
    headers['List-Unsubscribe'] = parts.join(', ');
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  if (campaignId) {
    // Brevo reads these and groups statistics per campaign.
    headers['X-Mailin-Tag'] = String(campaignId);
    headers['X-Mailin-Custom'] = JSON.stringify({ campaign: String(campaignId) });
  }

  headers['Message-ID'] = `<${crypto.randomUUID()}@${domainOf(fromEmail)}>`;
  return headers;
}

/**
 * Send exactly one message to exactly one recipient.
 * One recipient per message is deliberate - BCC blasts get filtered, and
 * per-recipient sends are what make {placeholder} personalisation possible.
 */
export async function sendMail({
  to,
  toName,
  subject,
  html,
  text,
  fromName,
  fromEmail,
  replyTo,
  unsubscribeUrl,
  campaignId,
}) {
  const senderEmail = fromEmail || env.mail.fromEmail;
  const senderName = fromName || env.mail.fromName;
  const replyAddress = replyTo || env.mail.replyTo || senderEmail;

  if (!senderEmail) {
    throw new Error('No sender address configured. Set MAIL_FROM_EMAIL in backend/.env.');
  }

  const info = await getTransporter().sendMail({
    from: formatAddress(senderName, senderEmail),
    to: formatAddress(toName, to),
    replyTo: replyAddress,
    envelope: { from: senderEmail, to },
    subject,
    html,
    text,
    headers: buildHeaders({
      unsubscribeUrl,
      replyTo: replyAddress,
      campaignId,
      fromEmail: senderEmail,
    }),
  });

  return { messageId: info.messageId, response: info.response, accepted: info.accepted };
}

/**
 * Brevo HTTP API fallback. Used when SMTP is blocked (common on PaaS hosts
 * that close port 587) or when the relay refuses a connection.
 */
export async function sendMailViaApi({
  to,
  toName,
  subject,
  html,
  text,
  fromName,
  fromEmail,
  replyTo,
  unsubscribeUrl,
  campaignId,
}) {
  if (!env.brevo.apiKey) throw new Error('BREVO_API_KEY is not configured');

  const senderEmail = fromEmail || env.mail.fromEmail;
  const payload = {
    sender: { name: fromName || env.mail.fromName, email: senderEmail },
    to: [{ email: to, name: toName || undefined }],
    replyTo: { email: replyTo || env.mail.replyTo || senderEmail },
    subject,
    htmlContent: html,
    textContent: text,
    headers: buildHeaders({
      unsubscribeUrl,
      replyTo: replyTo || env.mail.replyTo || senderEmail,
      campaignId,
      fromEmail: senderEmail,
    }),
    tags: campaignId ? [String(campaignId)] : undefined,
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.brevo.apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || `Brevo API responded ${response.status}`);
  }
  return { messageId: body.messageId, response: 'brevo-api', accepted: [to] };
}

/** SMTP first, HTTP API second. */
export async function sendMailResilient(message) {
  try {
    return await sendMail(message);
  } catch (smtpError) {
    if (!env.brevo.apiKey) throw smtpError;
    try {
      const result = await sendMailViaApi(message);
      return { ...result, fallback: true, smtpError: smtpError.message };
    } catch (apiError) {
      throw new Error(`SMTP: ${smtpError.message} | API: ${apiError.message}`);
    }
  }
}

/**
 * Turn a raw relay rejection into something a human can act on.
 * These three account for nearly every first-run failure.
 */
function explainRelayError(message = '') {
  const text = String(message);

  if (/unauthoriz|unrecognised ip|unrecognized ip|5\.7\.1/i.test(text)) {
    const ip = text.match(/(?:\d{1,3}\.){3}\d{1,3}|[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){4,7}/i)?.[0];
    return {
      reason: 'ip-not-authorised',
      hint: `Brevo is refusing this server's IP address${ip ? ` (${ip})` : ''}, so authentication fails before any recipient is considered. Authorise it at https://app.brevo.com/security/authorised_ips — or turn the IP restriction off, which is the practical choice on a connection with a changing address.`,
    };
  }

  if (/sender|not valid|not been validated|unrecognised sender/i.test(text)) {
    return {
      reason: 'sender-not-validated',
      hint: `The sender address is not validated in Brevo. Add it under Senders, Domains & Dedicated IPs → Senders, confirm the verification email, then set MAIL_FROM_EMAIL to that exact address.`,
    };
  }

  if (/invalid login|authentication failed|535/i.test(text)) {
    return {
      reason: 'bad-credentials',
      hint: 'Brevo rejected the SMTP login. Check BREVO_SMTP_LOGIN and BREVO_SMTP_KEY in backend/.env against SMTP & API → SMTP in the Brevo dashboard.',
    };
  }

  return { reason: 'unknown', hint: '' };
}

/**
 * Check the relay is actually usable before a campaign commits to a list.
 *
 * Without this, an account-level problem such as an unauthorised IP is only
 * discovered once per recipient, which marks every row failed and reads as
 * though the addresses were at fault.
 */
export async function preflight() {
  const smtp = await verifyConnection();
  if (smtp.ok) return { ok: true, via: 'smtp' };

  // SMTP may be blocked by the host while the HTTP API still works.
  if (env.brevo.apiKey) {
    const account = await getBrevoAccount();
    if (account) return { ok: true, via: 'api', smtpError: smtp.error };
  }

  return {
    ok: false,
    via: null,
    error: smtp.error,
    ...explainRelayError(smtp.error),
  };
}

/** Brevo account snapshot - used by the dashboard to show remaining credits. */
export async function getBrevoAccount() {
  if (!env.brevo.apiKey) return null;
  try {
    const response = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': env.brevo.apiKey, accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const credits = data?.plan?.find?.((plan) => plan.type === 'free' || plan.credits !== undefined);
    return {
      email: data.email,
      companyName: data?.companyName || '',
      plan: data?.plan || [],
      credits: credits?.credits ?? null,
    };
  } catch {
    return null;
  }
}

export function closeTransporter() {
  if (transporter) {
    transporter.close();
    transporter = null;
  }
}

export default {
  sendMail,
  sendMailViaApi,
  sendMailResilient,
  verifyConnection,
  preflight,
  getBrevoAccount,
};
