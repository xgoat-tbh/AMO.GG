/**
 * Anti-Promotion Scanner
 * Detects and blocks promotional content with smart bypass detection.
 */

import { promotionConfig } from '../../config/promotion.config.js';

const { shorteners: SHORTENERS, socialDomains: SOCIAL_DOMAINS, bypassPatterns: BYPASS_PATTERNS } = promotionConfig;

// Discord invite patterns
const DISCORD_INVITE_RE = /(?:discord\.(?:gg|io|me|media|app\/invite|com\/invite)|invite\.gg)\/[a-zA-Z0-9_-]+/gi;

// URL pattern (matches http/https and protocol-relative)
const URL_RE = /(https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)(?:\/[^\s]*)?/gi;

export function scanForPromotion(content, guildId, db, promotionRepo) {
  if (!content || typeof content !== 'string') return { detected: false };

  const config = promotionRepo.getConfig(db, guildId);
  if (!config.enabled) return { detected: false };

  const results = { detected: false, reasons: [], domains: [], invites: [] };

  // Normalize text: strip zero-width chars, normalize spaces
  const normalized = content
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Check bypass patterns
  for (const pattern of BYPASS_PATTERNS) {
    if (pattern.test(normalized)) {
      results.detected = true;
      results.reasons.push('Suspicious formatting detected');
      break;
    }
  }

  // Find all URLs
  let match;
  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(normalized)) !== null) {
    const fullDomain = match[2]?.toLowerCase();
    if (!fullDomain) continue;
    results.domains.push(fullDomain);

    // Check if domain is a shortener
    if (SHORTENERS.some(s => fullDomain === s || fullDomain.endsWith('.' + s))) {
      results.detected = true;
      results.reasons.push('URL shortener not allowed');
      continue;
    }

    // Check if blacklisted
    if (promotionRepo.isBlacklisted(db, guildId, fullDomain)) {
      results.detected = true;
      results.reasons.push(`Domain blacklisted: ${fullDomain}`);
      continue;
    }

    // If strict mode, check whitelist for social domains
    if (config.strict_mode && SOCIAL_DOMAINS.some(s => fullDomain === s || fullDomain.endsWith('.' + s))) {
      if (!promotionRepo.isWhitelisted(db, guildId, fullDomain)) {
        results.detected = true;
        results.reasons.push(`Social media link not allowed: ${fullDomain}`);
        continue;
      }
    }

    // If not whitelisted and not a known safe domain, flag in strict mode
    if (config.strict_mode && !promotionRepo.isWhitelisted(db, guildId, fullDomain)) {
      results.detected = true;
      results.reasons.push(`Domain not whitelisted: ${fullDomain}`);
    }
  }

  // Find Discord invites
  let inviteMatch;
  DISCORD_INVITE_RE.lastIndex = 0;
  while ((inviteMatch = DISCORD_INVITE_RE.exec(normalized)) !== null) {
    results.invites.push(inviteMatch[0]);
    if (!promotionRepo.isWhitelisted(db, guildId, 'discord.gg')) {
      results.detected = true;
      results.reasons.push('Discord invite not allowed');
    }
  }

  return results;
}

export function isLikelyPromotion(content) {
  if (!content || typeof content !== 'string') return false;

  // Quick pre-scan without DB access
  const hasUrl = URL_RE.test(content);
  URL_RE.lastIndex = 0;

  const hasInvite = DISCORD_INVITE_RE.test(content);
  DISCORD_INVITE_RE.lastIndex = 0;

  const hasBypass = BYPASS_PATTERNS.some(p => p.test(content));

  return hasUrl || hasInvite || hasBypass;
}
