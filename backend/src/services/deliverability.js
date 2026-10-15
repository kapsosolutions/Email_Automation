import { htmlToText } from './templateEngine.js';

/**
 * Static lint that scores a draft against the heuristics content filters
 * actually use. Not a guarantee of inbox placement - authentication
 * (SPF/DKIM/DMARC) and sender reputation matter far more - but it catches the
 * self-inflicted mistakes before a campaign goes out.
 */
const SPAM_PHRASES = [
  'act now', 'apply now', 'buy direct', 'cash bonus', 'cheap', 'click here',
  'congratulations', 'credit card offers', 'dear friend', 'double your income',
  'earn money', 'easy money', 'eliminate debt', 'exclusive deal', 'expire',
  'fast cash', 'for free', 'free access', 'free gift', 'free money', 'free trial',
  'get paid', 'guarantee', 'hidden charges', 'income', 'instant', 'limited time',
  'lose weight', 'lowest price', 'make money', 'miracle', 'no catch',
  'no credit check', 'no hidden costs', 'no obligation', 'no risk',
  'once in a lifetime', 'one time', 'only $', 'order now', 'pre-approved',
  'risk free', 'satisfaction guaranteed', 'save big', 'special promotion',
  'this is not spam', 'unlimited', 'urgent', 'what are you waiting for',
  'winner', 'you have been selected',
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function analyzeContent({ subject = '', html = '', preheader = '', fromEmail = '' }) {
  const text = htmlToText(html);
  const haystack = `${subject} ${preheader} ${text}`.toLowerCase();
  const issues = [];
  let score = 100;

  const penalise = (points, level, title, detail) => {
    score -= points;
    issues.push({ level, title, detail, points });
  };

  // --- subject ---------------------------------------------------------
  if (!subject.trim()) {
    penalise(25, 'error', 'Subject is empty', 'Messages without a subject are routinely rejected.');
  } else {
    if (subject.length > 70) {
      penalise(6, 'warning', 'Subject is long', `${subject.length} characters. Aim for 30-60 so it is not truncated.`);
    }
    const letters = subject.replace(/[^A-Za-z]/g, '');
    const caps = subject.replace(/[^A-Z]/g, '').length;
    if (letters.length > 6 && caps / letters.length > 0.5) {
      penalise(12, 'error', 'Subject is mostly capitals', 'Shouting in the subject line is a classic spam marker.');
    }
    const exclamations = (subject.match(/!/g) || []).length;
    if (exclamations > 1) {
      penalise(8, 'warning', 'Multiple exclamation marks', `${exclamations} found in the subject.`);
    }
    if (/\$|€|£|\d+\s*%\s*off/i.test(subject)) {
      penalise(5, 'info', 'Currency or discount in subject', 'Price-led subjects score worse with content filters.');
    }
    if (/^(re|fwd):/i.test(subject.trim())) {
      penalise(10, 'error', 'Fake reply prefix', 'Starting with "Re:" or "Fwd:" on a cold send is treated as deceptive.');
    }
  }

  // --- body ------------------------------------------------------------
  if (!text.trim()) {
    penalise(30, 'error', 'Body is empty', 'There is no readable text in the message.');
  } else if (text.length < 120) {
    penalise(8, 'warning', 'Very little text', 'Short, image-heavy mail looks like a template blast.');
  }

  const imageCount = (html.match(/<img\b/gi) || []).length;
  if (imageCount > 0 && text.length < imageCount * 80) {
    penalise(10, 'warning', 'Image-heavy layout', `${imageCount} images against ${text.length} characters of text.`);
  }
  if (imageCount > 0 && !/<img[^>]*\balt=/i.test(html)) {
    penalise(4, 'info', 'Images without alt text', 'Add alt attributes - filters and screen readers both use them.');
  }

  const links = html.match(/href=["']https?:\/\/[^"']+/gi) || [];
  if (links.length > 12) {
    penalise(8, 'warning', 'Many links', `${links.length} links found. Keep it under about ten.`);
  }
  if (/href=["']https?:\/\/(bit\.ly|tinyurl|goo\.gl|t\.co|is\.gd|ow\.ly)/i.test(html)) {
    penalise(12, 'error', 'URL shortener detected', 'Shortened links hide the destination and are heavily penalised.');
  }
  if (/href=["']https?:\/\/\d{1,3}(\.\d{1,3}){3}/.test(html)) {
    penalise(15, 'error', 'Raw IP address link', 'Links to bare IPs are a strong spam signal.');
  }

  const hits = SPAM_PHRASES.filter((phrase) => haystack.includes(phrase));
  if (hits.length) {
    penalise(clamp(hits.length * 4, 4, 24), hits.length > 3 ? 'error' : 'warning', 'Spam-trigger wording', `Found: ${hits.slice(0, 8).join(', ')}${hits.length > 8 ? '…' : ''}`);
  }

  if (/<(script|iframe|form|object|embed)\b/i.test(html)) {
    penalise(20, 'error', 'Disallowed HTML', 'script, iframe, form and embed tags are stripped or flagged by mail clients.');
  }

  // --- compliance ------------------------------------------------------
  if (!/unsubscribe/i.test(haystack)) {
    issues.push({
      level: 'info',
      title: 'Unsubscribe link added automatically',
      detail: 'Every send gets a List-Unsubscribe header plus a footer link, so this is covered.',
      points: 0,
    });
  }
  if (!preheader.trim()) {
    penalise(3, 'info', 'No preheader', 'The preview text is the second thing a recipient reads. Set it.');
  }

  // --- personalisation -------------------------------------------------
  if (!/\{\{?\s*[a-zA-Z0-9_\-. ]+\s*\}?\}/.test(`${subject}${html}`)) {
    penalise(5, 'info', 'No personalisation', 'Add at least one {placeholder} - identical bodies to many recipients cluster together in filters.');
  }

  // --- sender ----------------------------------------------------------
  const freeDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com'];
  const senderDomain = String(fromEmail || '').split('@')[1]?.toLowerCase();
  if (senderDomain && freeDomains.includes(senderDomain)) {
    penalise(20, 'error', 'Free-mail sender address', `${senderDomain} cannot be DMARC-aligned through Brevo. Send from a domain you control.`);
  }
  if (senderDomain && /^(noreply|no-reply|donotreply)@/i.test(String(fromEmail))) {
    penalise(5, 'info', 'noreply sender', 'A monitored reply address improves engagement signals.');
  }

  score = clamp(Math.round(score), 0, 100);
  const grade = score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'risky' : 'poor';

  return {
    score,
    grade,
    issues: issues.sort((a, b) => b.points - a.points),
    stats: {
      subjectLength: subject.length,
      textLength: text.length,
      imageCount,
      linkCount: links.length,
      spamPhraseHits: hits.length,
    },
  };
}

export default { analyzeContent };
