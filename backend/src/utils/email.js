// Pragmatic address validation: strict enough to stop the garbage that kills
// sender reputation, loose enough not to reject valid exotic addresses.
const EMAIL_RE = /^[^\s@,;:<>()[\]\\"]+@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

// Addresses that exist only to poison a list.
const ROLE_PREFIXES = new Set([
  'abuse',
  'postmaster',
  'noreply',
  'no-reply',
  'donotreply',
  'spam',
  'devnull',
]);

export function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .replace(/^<|>$/g, '')
    .toLowerCase();
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  if (!email || email.length > 254) return false;
  if (email.includes('..')) return false;
  const [local, domain] = email.split('@');
  if (!local || !domain || local.length > 64) return false;
  if (domain.endsWith('.')) return false;
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) return false;
  return EMAIL_RE.test(email);
}

export function isRoleAddress(value) {
  const local = normalizeEmail(value).split('@')[0] || '';
  return ROLE_PREFIXES.has(local);
}

/** RFC 5322 display-name + address, quoted if the name contains specials. */
export function formatAddress(name, email) {
  if (!name) return email;
  const safe = String(name).replace(/["\\]/g, '');
  return /[",;:<>@[\]]/.test(safe) ? `"${safe}" <${email}>` : `${safe} <${email}>`;
}

export default { normalizeEmail, isValidEmail, isRoleAddress, formatAddress };
