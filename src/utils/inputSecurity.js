const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const ANGLE_BRACKETS = /[<>]/g;

export function sanitizePlainText(value, maxLength = 2000) {
  return String(value ?? '')
    .replace(CONTROL_CHARS, ' ')
    .replace(ANGLE_BRACKETS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeLongText(value, maxLength = 6000) {
  return String(value ?? '')
    .replace(CONTROL_CHARS, ' ')
    .replace(ANGLE_BRACKETS, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeUrl(value, maxLength = 500) {
  const raw = sanitizePlainText(value, maxLength);
  if (!raw) return '';

  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString().slice(0, maxLength);
  } catch {
    return '';
  }
}

export function parseReferenceLinks(value, maxItems = 3) {
  const rawItems = String(value ?? '')
    .split(/[\n,]+/)
    .map(item => item.trim())
    .filter(Boolean);

  const links = [];
  const invalid = [];

  rawItems.forEach(item => {
    const clean = sanitizeUrl(item);
    if (clean) links.push(clean);
    else invalid.push(sanitizePlainText(item, 120));
  });

  return {
    links: links.slice(0, maxItems),
    invalid,
  };
}

export function appendReferenceLinksToText(text, links) {
  const cleanText = sanitizeLongText(text, 6000);
  const cleanLinks = (Array.isArray(links) ? links : [])
    .map(link => sanitizeUrl(link))
    .filter(Boolean)
    .slice(0, 3);

  if (!cleanLinks.length) return cleanText;

  return sanitizeLongText(
    `${cleanText}\n\nReference examples:\n${cleanLinks.map((link, index) => `${index + 1}. ${link}`).join('\n')}`,
    6000
  );
}

export function sanitizeTagList(value, maxItems = 12, itemLength = 36) {
  return String(value ?? '')
    .split(',')
    .map(item => sanitizePlainText(item, itemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function clampNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = null } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
