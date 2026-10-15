import env from '../config/env.js';
import { encodeUrl, sign } from '../utils/signature.js';

/**
 * Placeholder syntax
 * ------------------
 *   {name}            -> value of the "name" column
 *   {{name}}          -> same, double braces also accepted
 *   {name|there}      -> "there" when the column is empty or missing
 *
 * Keys are matched loosely: {first_name}, {First Name} and {firstname} all
 * resolve to a spreadsheet column called "First Name".
 */
const PLACEHOLDER_RE = /\{\{?\s*([a-zA-Z0-9_\-. ]+?)\s*(?:\|\s*([^}]*?)\s*)?\}?\}/g;

const RESERVED = new Set(['unsubscribe_url', 'unsubscribe', 'email', 'tracking_pixel']);

const loose = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');

export function extractPlaceholders(...sources) {
  const found = new Map();
  for (const source of sources) {
    if (!source) continue;
    const text = String(source);
    PLACEHOLDER_RE.lastIndex = 0;
    let match = PLACEHOLDER_RE.exec(text);
    while (match) {
      const key = match[1].trim();
      if (key && !found.has(loose(key))) found.set(loose(key), key);
      match = PLACEHOLDER_RE.exec(text);
    }
  }
  return [...found.values()];
}

/** Build a loose-key lookup from a contact row plus any default values. */
export function buildContext(row = {}, defaults = {}, extra = {}) {
  const context = new Map();
  const put = (key, value) => {
    if (key === undefined || key === null) return;
    const k = loose(key);
    if (!k) return;
    const v = value === undefined || value === null ? '' : String(value);
    if (v !== '' || !context.has(k)) context.set(k, v);
  };

  Object.entries(defaults || {}).forEach(([key, value]) => put(key, value));
  Object.entries(row || {}).forEach(([key, value]) => put(key, value));
  Object.entries(extra || {}).forEach(([key, value]) => context.set(loose(key), value ?? ''));

  return context;
}

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Substitute every placeholder. Unresolved keys collapse to the inline
 * fallback, or to an empty string, so a recipient never sees "{name}".
 */
export function render(template, context, { escape = false } = {}) {
  if (!template) return '';
  return String(template).replace(PLACEHOLDER_RE, (full, rawKey, fallback) => {
    const value = context.get(loose(rawKey));
    const resolved = value !== undefined && value !== '' ? value : (fallback ?? '');
    return escape ? escapeHtml(resolved) : resolved;
  });
}

/** Placeholders in the template that the chosen list cannot fill. */
export function findUnmatchedPlaceholders(placeholders, columns, defaults = {}) {
  const known = new Set([
    ...columns.map(loose),
    ...Object.keys(defaults || {}).map(loose),
    ...[...RESERVED].map(loose),
  ]);
  return placeholders.filter((key) => !known.has(loose(key)));
}

/** Map every template placeholder to the column that will fill it. */
export function mapPlaceholders(placeholders, columns, defaults = {}) {
  const byLoose = new Map(columns.map((column) => [loose(column), column]));
  return placeholders.map((key) => {
    const column = byLoose.get(loose(key)) || null;
    const fallback = Object.entries(defaults || {}).find(([d]) => loose(d) === loose(key));
    return {
      placeholder: key,
      column,
      status: column ? 'matched' : fallback ? 'default' : RESERVED.has(loose(key)) ? 'system' : 'unmatched',
      defaultValue: fallback ? fallback[1] : '',
    };
  });
}

// ---------------------------------------------------------------------------
// HTML -> text. Every message ships a plaintext alternative; HTML-only mail is
// one of the strongest spam signals there is.
// ---------------------------------------------------------------------------
export function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '  - ')
    .replace(/<a [^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      if (!text) return href;
      return href.startsWith('http') ? `${text} (${href})` : text;
    })
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function trackingUrls(trackId) {
  const token = sign(trackId);
  return {
    pixel: `${env.publicUrl}/t/o/${trackId}.png?s=${token}`,
    unsubscribe: `${env.publicUrl}/t/u/${trackId}?s=${token}`,
    click: (url) => `${env.publicUrl}/t/c/${trackId}?s=${token}&u=${encodeUrl(url)}`,
  };
}

/** Rewrite outbound http(s) links through the signed click endpoint. */
export function rewriteLinks(html, trackId) {
  const { click } = trackingUrls(trackId);
  return String(html).replace(
    /(<a\b[^>]*\bhref=["'])(https?:\/\/[^"']+)(["'])/gi,
    (match, pre, url, post) => {
      if (url.startsWith(env.publicUrl)) return match; // already ours
      if (/\bno-?track\b/i.test(match)) return match;
      return `${pre}${click(url)}${post}`;
    },
  );
}

const PREHEADER_STYLE =
  'display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;';

/**
 * Wrap rendered body HTML in an email-client-safe document.
 * Table layout, inline styles, a real preheader, and a visible unsubscribe
 * footer (required by Gmail/Yahoo bulk-sender rules).
 */
export function wrapHtml({ bodyHtml, subject, preheader, unsubscribeUrl, pixelUrl, fromName, address }) {
  const safeSubject = escapeHtml(subject || '');
  const pre = escapeHtml(preheader || '');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "https://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f9fa;">
<div style="${PREHEADER_STYLE}">${pre}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f9fa;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;border:1px solid #dadce0;border-radius:4px;">
        <tr>
          <td style="padding:32px 32px 8px 32px;font-family:'Google Sans Text',Arial,Helvetica,sans-serif;font-size:18px;line-height:28px;color:#202124;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px 32px;">
            <hr style="border:none;border-top:1px solid #dadce0;margin:0 0 16px 0;" />
            <p style="margin:0 0 8px 0;font-family:'Google Sans Text',Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#5f6368;">
              You received this message because you subscribed to updates from ${escapeHtml(fromName || env.appName)}.
            </p>
            ${
              address
                ? `<p style="margin:0 0 8px 0;font-family:'Google Sans Text',Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#80868b;">${escapeHtml(address)}</p>`
                : ''
            }
            <p style="margin:0;font-family:'Google Sans Text',Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#5f6368;">
              <a href="${unsubscribeUrl}" style="color:#1a73e8;text-decoration:underline;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;border:0;outline:none;" />
</body>
</html>`;
}

/**
 * Produce the final per-recipient message. This is the single place where a
 * template, a contact row and the tracking layer come together.
 */
export function composeMessage({
  template,
  contact,
  trackId,
  defaults = {},
  wrap = true,
  tracking = true,
}) {
  const context = buildContext(contact?.data || {}, defaults, {
    email: contact?.email || '',
    name: contact?.name || contact?.data?.name || '',
  });

  const urls = trackingUrls(trackId);
  context.set('unsubscribeurl', urls.unsubscribe);
  context.set('unsubscribe', urls.unsubscribe);

  const subject = render(template.subject, context).replace(/\s+/g, ' ').trim();
  const preheader = render(template.preheader || '', context).trim();
  let bodyHtml = render(template.html, context, { escape: false });

  if (tracking) bodyHtml = rewriteLinks(bodyHtml, trackId);

  const html = wrap
    ? wrapHtml({
        bodyHtml,
        subject,
        preheader,
        unsubscribeUrl: urls.unsubscribe,
        pixelUrl: urls.pixel,
        fromName: template.fromName || env.mail.fromName,
        address: template.address || '',
      })
    : bodyHtml;

  const text = `${htmlToText(bodyHtml)}\n\n---\nUnsubscribe: ${urls.unsubscribe}`;

  return { subject, html, text, preheader, unsubscribeUrl: urls.unsubscribe };
}

export default {
  extractPlaceholders,
  buildContext,
  render,
  mapPlaceholders,
  findUnmatchedPlaceholders,
  htmlToText,
  wrapHtml,
  rewriteLinks,
  trackingUrls,
  composeMessage,
};
