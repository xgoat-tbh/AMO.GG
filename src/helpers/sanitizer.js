/**
 * Input sanitization and content filtering utility.
 */

const BADWORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard',
  'nigger', 'cunt', 'retard', 'whore', 'slut'
];

/**
 * Check if text contains profanity.
 */
export function isProfane(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  // Remove common leetspeak substitutions for basic detection
  const normalized = lower
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/@/g, 'a').replace(/\$/g, 's').replace(/!/g, 'i');
  return BADWORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(normalized);
  });
}

/**
 * Strip Discord mention syntax from text to prevent mass-pinging.
 * Replaces @everyone, @here, and <@&roleId> mentions with safe text.
 */
export function sanitizeMentions(text) {
  if (!text) return text;
  return text
    .replace(/@(everyone|here)/gi, '@\u200b$1')
    .replace(/<@[!&]?\d+>/g, match => {
      return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    });
}

/**
 * Truncate text to a maximum length with optional ellipsis.
 */
export function truncate(text, maxLength, ellipsis = true) {
  if (!text || text.length <= maxLength) return text;
  return ellipsis ? text.slice(0, maxLength - 3) + '...' : text.slice(0, maxLength);
}

/**
 * Strip zero-width and invisible Unicode characters.
 */
export function stripInvisibleChars(text) {
  if (!text) return text;
  return text.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064]/g, '');
}

/**
 * Validate that content length is within bounds.
 * Returns { valid: boolean, reason?: string }
 */
export function validateLength(text, maxLength, fieldName = 'Content') {
  if (!text || !text.trim()) {
    return { valid: false, reason: `${fieldName} cannot be empty.` };
  }
  if (text.length > maxLength) {
    return { valid: false, reason: `${fieldName} must be under ${maxLength} characters (${text.length} given).` };
  }
  return { valid: true };
}

/**
 * Full sanitization pipeline for user text content.
 * Order: strip invisible chars -> validate length -> profanity check -> sanitize mentions
 */
export function sanitizeContent(text, maxLength, fieldName) {
  if (!text) return { sanitized: '', valid: true };

  let cleaned = stripInvisibleChars(text);
  const trimmed = cleaned.trim();

  const lengthCheck = validateLength(trimmed, maxLength, fieldName);
  if (!lengthCheck.valid) {
    return { sanitized: trimmed, valid: false, reason: lengthCheck.reason };
  }

  if (isProfane(trimmed)) {
    return { sanitized: trimmed, valid: false, reason: `${fieldName} contains inappropriate language.` };
  }

  // Sanitize mentions to prevent mass-pinging
  cleaned = sanitizeMentions(trimmed);

  return { sanitized: cleaned, valid: true };
}