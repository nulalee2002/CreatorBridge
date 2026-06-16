/**
 * Message filter: detects and blocks sharing of contact info in messages.
 * Returns { blocked: false } if clean, or { blocked: true, patternType } if flagged.
 */

const PATTERNS = [
  {
    type: 'email',
    // Standard email pattern
    regex: /[a-zA-Z0-9._%+\-]+\s*@\s*[a-zA-Z0-9.\-]+\s*\.\s*[a-zA-Z]{2,}/,
  },
  {
    type: 'email_workaround',
    // "at gmail dot com", "at yahoo dot com", etc.
    regex: /\bat\s+\w+\s+dot\s+(com|net|org|io|co|me|us|uk)\b/i,
  },
  {
    type: 'phone',
    // 7+ consecutive digits with optional separators (spaces, dashes, parens, dots)
    regex: /(\+?\d[\s\-.\(\)]{0,2}){7,}\d/,
  },
  {
    type: 'phone_words',
    // Written-out digits e.g. "five five five one two three four"
    regex: /\b(zero|one|two|three|four|five|six|seven|eight|nine)\b[\s\-]*(zero|one|two|three|four|five|six|seven|eight|nine)\b[\s\-]*(zero|one|two|three|four|five|six|seven|eight|nine)\b[\s\-]*(zero|one|two|three|four|five|six|seven|eight|nine)\b/i,
  },
  {
    type: 'url',
    regex: /(https?:\/\/|www\.)[^\s]+/i,
  },
  {
    type: 'url_tld',
    // Domain-like patterns: word.com, word.net, word.io, etc.
    regex: /\b\w+\.(com|net|org|io|co|me|us|uk|studio|app|dev|tv|media|photography|film|video)\b/i,
  },
  {
    type: 'social_handle',
    // @username patterns (but allow @mentions of platform UI context)
    regex: /@[a-zA-Z0-9_\.]{2,}/,
  },
  {
    type: 'platform_name',
    regex: /\b(instagram|youtube|youtu\.be|vimeo|linkedin|loom|tiktok|facebook|twitter|x\.com|snapchat|threads)\b/i,
  },
  {
    type: 'payment_app',
    regex: /\b(venmo|cash\s*app|cashapp|zelle|paypal|pay\s*pal)\b/i,
  },
];

const CREATOR_TEXT_FIELDS = ['name', 'businessName', 'business_name', 'bio', 'title', 'description'];
export const CREATOR_TEXT_BLOCK_MESSAGE = 'Keep it on CreatorBridge. Remove links, handles, phone numbers, email addresses, payment apps, or outside platform names before continuing.';

/**
 * Check message text for contact info violations.
 * @param {string} text
 * @returns {{ blocked: boolean, patternType?: string }}
 */
export function checkMessage(text) {
  if (!text) return { blocked: false };
  for (const { type, regex } of PATTERNS) {
    if (regex.test(text)) {
      return { blocked: true, patternType: type };
    }
  }
  return { blocked: false };
}

/**
 * Check creator-written public profile text for outbound contact attempts.
 * @param {Record<string, string>|string} input
 * @returns {{ blocked: boolean, patternType?: string, field?: string, message?: string }}
 */
export function checkCreatorText(input) {
  if (typeof input === 'string') {
    const result = checkMessage(input);
    return result.blocked ? { ...result, message: CREATOR_TEXT_BLOCK_MESSAGE } : result;
  }

  for (const field of CREATOR_TEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input || {}, field)) continue;
    const result = checkMessage(input[field]);
    if (result.blocked) {
      return { ...result, field, message: CREATOR_TEXT_BLOCK_MESSAGE };
    }
  }
  return { blocked: false };
}

/**
 * Log a filter event. Stores pattern type only — never the message text.
 * @param {string} userId
 * @param {string} patternType
 * @param {import('../lib/supabase.js').SupabaseClient|null} supabase
 * @param {boolean} supabaseConfigured
 */
export async function logFilterEvent(userId, patternType, supabase, supabaseConfigured) {
  const event = {
    userId,
    patternType,
    timestamp: new Date().toISOString(),
  };
  // Supabase (if configured)
  if (supabaseConfigured && supabase) {
    try {
      await supabase.from('message_filter_events').insert({
        user_id: userId,
        pattern_type: patternType,
        created_at: event.timestamp,
      });
    } catch {}
  }
  // Always also track count in localStorage for spam scoring
  try {
    const key = `cm-filter-events-${userId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(event);
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {}
}

/**
 * Get the number of filter events for a user in the last 24 hours.
 */
export function recentFilterCount(userId) {
  try {
    const key = `cm-filter-events-${userId}`;
    const events = JSON.parse(localStorage.getItem(key) || '[]');
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return events.filter(e => new Date(e.timestamp).getTime() > cutoff).length;
  } catch { return 0; }
}
