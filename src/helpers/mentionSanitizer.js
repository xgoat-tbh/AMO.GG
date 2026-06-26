/**
 * Mention sanitizer — strips dangerous mentions from user-generated content.
 * Applied globally before storage or display.
 */

const EVERYONE_REGEX = /@everyone/gi;
const HERE_REGEX = /@here/gi;
const ROLE_MENTION_REGEX = /<@&(\d+)>/g;
const USER_MENTION_REGEX = /<@!?(\d+)>/g;

/**
 * Sanitize content — removes @everyone, @here, and role mentions.
 * User mentions are preserved by default.
 */
export function sanitize(content, { stripUserMentions = false } = {}) {
  if (!content) return '';

  let sanitized = content
    .replace(EVERYONE_REGEX, '@\u200Beveryone')
    .replace(HERE_REGEX, '@\u200Bhere')
    .replace(ROLE_MENTION_REGEX, '@\u200Brole');

  if (stripUserMentions) {
    sanitized = sanitized.replace(USER_MENTION_REGEX, '@\u200Buser');
  }

  return sanitized;
}

/**
 * Check if content contains dangerous mentions.
 */
export function hasDangerousMentions(content) {
  if (!content) return false;
  return EVERYONE_REGEX.test(content) || HERE_REGEX.test(content) || ROLE_MENTION_REGEX.test(content);
}
