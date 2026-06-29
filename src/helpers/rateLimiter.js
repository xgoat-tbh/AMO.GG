/**
 * Simple in-memory rate limiter for commands and interactions.
 * Uses sliding window algorithm.
 */

// Command rate limits: { commandName: { count, windowMs, maxRequests } }
const COMMAND_LIMITS = {
  default: { maxRequests: 5, windowMs: 10000 }, // 5 requests per 10 seconds
  // More restrictive limits for specific commands
  'suggest': { maxRequests: 3, windowMs: 60000 }, // 3 per minute
  'confess': { maxRequests: 2, windowMs: 60000 }, // 2 per minute
  'giveaway': { maxRequests: 3, windowMs: 60000 }, // 3 per minute
  'gpvc': { maxRequests: 3, windowMs: 60000 }, // 3 per minute
  'embed': { maxRequests: 2, windowMs: 60000 }, // 2 per minute
  'jail': { maxRequests: 5, windowMs: 60000 }, // 5 per minute
  'unjail': { maxRequests: 5, windowMs: 60000 }, // 5 per minute
  'role': { maxRequests: 10, windowMs: 10000 }, // 10 per 10 seconds
  'config': { maxRequests: 5, windowMs: 60000 }, // 5 per minute
  'reset': { maxRequests: 1, windowMs: 300000 }, // 1 per 5 minutes
  'creator': { maxRequests: 2, windowMs: 300000 }, // 2 per 5 minutes
};

// Interaction rate limits: { customIdPrefix: { maxRequests, windowMs } }
const INTERACTION_LIMITS = {
  default: { maxRequests: 10, windowMs: 10000 }, // 10 per 10 seconds
  'gpvc:': { maxRequests: 5, windowMs: 10000 }, // 5 per 10 seconds for GPVC
  'config:': { maxRequests: 5, windowMs: 10000 }, // 5 per 10 seconds for config
  'suggestion:vote': { maxRequests: 10, windowMs: 10000 }, // 10 per 10 seconds
  'confession:': { maxRequests: 3, windowMs: 60000 }, // 3 per minute
  'giveaway:enter': { maxRequests: 5, windowMs: 10000 }, // 5 per 10 seconds
  'embed:': { maxRequests: 5, windowMs: 10000 }, // 5 per 10 seconds
  'admin:reset': { maxRequests: 2, windowMs: 300000 }, // 2 per 5 minutes
  'dev:': { maxRequests: 5, windowMs: 10000 }, // 5 per 10 seconds
  'help:': { maxRequests: 10, windowMs: 10000 }, // 10 per 10 seconds
};

// In-memory stores
const commandUsage = new Map(); // key: `${userId}:${commandName}` -> { count, windowStart }
const interactionUsage = new Map(); // key: `${userId}:${customIdPrefix}` -> { count, windowStart }

/**
 * Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of commandUsage.entries()) {
    if (now - data.windowStart > 300000) { // 5 minutes
      commandUsage.delete(key);
    }
  }
  for (const [key, data] of interactionUsage.entries()) {
    if (now - data.windowStart > 300000) {
      interactionUsage.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Check and record command usage for rate limiting.
 * @returns {boolean} true if allowed, false if rate limited
 */
export function checkCommandRateLimit(userId, commandName) {
  const now = Date.now();
  const limit = COMMAND_LIMITS[commandName] || COMMAND_LIMITS.default;
  const key = `${userId}:${commandName}`;

  let usage = commandUsage.get(key);
  if (!usage || now - usage.windowStart > limit.windowMs) {
    // New window
    usage = { count: 1, windowStart: now };
    commandUsage.set(key, usage);
    return true;
  }

  if (usage.count >= limit.maxRequests) {
    return false;
  }

  usage.count++;
  return true;
}

/**
 * Check and record interaction usage for rate limiting.
 * @returns {boolean} true if allowed, false if rate limited
 */
export function checkInteractionRateLimit(userId, customId) {
  const now = Date.now();

  // Find matching prefix
  let matchedPrefix = 'default';
  for (const prefix of Object.keys(INTERACTION_LIMITS)) {
    if (customId.startsWith(prefix)) {
      matchedPrefix = prefix;
      break;
    }
  }

  const limit = INTERACTION_LIMITS[matchedPrefix] || INTERACTION_LIMITS.default;
  const key = `${userId}:${matchedPrefix}`;

  let usage = interactionUsage.get(key);
  if (!usage || now - usage.windowStart > limit.windowMs) {
    usage = { count: 1, windowStart: now };
    interactionUsage.set(key, usage);
    return true;
  }

  if (usage.count >= limit.maxRequests) {
    return false;
  }

  usage.count++;
  return true;
}

/**
 * Get remaining requests for a command (for headers/info)
 */
export function getCommandRateLimitInfo(userId, commandName) {
  const limit = COMMAND_LIMITS[commandName] || COMMAND_LIMITS.default;
  const key = `${userId}:${commandName}`;
  const usage = commandUsage.get(key);

  if (!usage) {
    return { remaining: limit.maxRequests, resetIn: limit.windowMs };
  }

  const now = Date.now();
  if (now - usage.windowStart > limit.windowMs) {
    return { remaining: limit.maxRequests, resetIn: limit.windowMs };
  }

  return {
    remaining: Math.max(0, limit.maxRequests - usage.count),
    resetIn: limit.windowMs - (now - usage.windowStart)
  };
}

/**
 * Get remaining requests for an interaction
 */
export function getInteractionRateLimitInfo(userId, customId) {
  let matchedPrefix = 'default';
  for (const prefix of Object.keys(INTERACTION_LIMITS)) {
    if (customId.startsWith(prefix)) {
      matchedPrefix = prefix;
      break;
    }
  }

  const limit = INTERACTION_LIMITS[matchedPrefix] || INTERACTION_LIMITS.default;
  const key = `${userId}:${matchedPrefix}`;
  const usage = interactionUsage.get(key);

  if (!usage) {
    return { remaining: limit.maxRequests, resetIn: limit.windowMs };
  }

  const now = Date.now();
  if (now - usage.windowStart > limit.windowMs) {
    return { remaining: limit.maxRequests, resetIn: limit.windowMs };
  }

  return {
    remaining: Math.max(0, limit.maxRequests - usage.count),
    resetIn: limit.windowMs - (now - usage.windowStart)
  };
}

/**
 * Reset rate limits for a user (useful for testing or admin)
 */
export function resetUserRateLimits(userId) {
  for (const key of commandUsage.keys()) {
    if (key.startsWith(`${userId}:`)) {
      commandUsage.delete(key);
    }
  }
  for (const key of interactionUsage.keys()) {
    if (key.startsWith(`${userId}:`)) {
      interactionUsage.delete(key);
    }
  }
}