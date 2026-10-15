import crypto from 'node:crypto';
import env from '../config/env.js';

/**
 * Tracking and unsubscribe links are public URLs, so every payload they carry
 * is HMAC-signed. Without this, the click endpoint would be an open redirect
 * and the unsubscribe endpoint would let anyone opt out anyone.
 */
export function sign(payload) {
  return crypto
    .createHmac('sha256', env.trackingSecret)
    .update(String(payload))
    .digest('base64url')
    .slice(0, 32);
}

export function verify(payload, signature) {
  const expected = sign(payload);
  if (!signature || signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
}

export function encodeUrl(url) {
  return Buffer.from(String(url), 'utf8').toString('base64url');
}

export function decodeUrl(encoded) {
  return Buffer.from(String(encoded), 'base64url').toString('utf8');
}

export function newTrackId() {
  return crypto.randomBytes(12).toString('base64url');
}

export default { sign, verify, encodeUrl, decodeUrl, newTrackId };
