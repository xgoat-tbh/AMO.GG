import { getDb } from '../../database/connection.js';
import { checkPermission } from '../../helpers/permissions.js';

// In-memory cache for deleted messages, keyed by channelId
// Each channel maps to an array of deleted message objects up to the configured limit
const snipes = new Map();
let cachedLimit = null;

/**
 * Gets the current snipe limit (1 to 20, default 20) from the database or cache.
 */
export function getMaxLimit() {
  if (cachedLimit !== null) return cachedLimit;
  try {
    const db = getDb();
    const limitRow = db.prepare("SELECT value FROM bot_config WHERE key = 'snipe_max_limit'").get();
    if (limitRow && limitRow.value) {
      const parsed = parseInt(limitRow.value, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 20) {
        cachedLimit = parsed;
        return cachedLimit;
      }
    }
  } catch (err) {
    // Fail silently, fallback to default
  }
  cachedLimit = 20;
  return cachedLimit;
}

/**
 * Sets the current snipe limit (1 to 20) and prunes existing cache arrays.
 */
export function setMaxLimit(limit) {
  cachedLimit = limit;
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO bot_config (key, value) VALUES ('snipe_max_limit', ?)").run(String(limit));

  // Prune existing cached snipes to the new limit
  for (const [channelId, list] of snipes.entries()) {
    if (list.length > limit) {
      list.splice(limit);
    }
  }
}

/**
 * Adds a deleted message to the in-memory cache.
 */
export function addDeletedMessage(message) {
  if (!message || !message.author || message.author.bot || !message.channel) return;

  const channelId = message.channel.id;
  if (!snipes.has(channelId)) {
    snipes.set(channelId, []);
  }

  const list = snipes.get(channelId);
  
  // Create message data object
  const data = {
    content: message.content || '',
    author: {
      tag: message.author.tag,
      id: message.author.id,
      displayName: message.member?.displayName || message.author.username,
      avatar: message.author.displayAvatarURL(),
    },
    timestamp: Math.floor(message.createdTimestamp / 1000),
    attachments: message.attachments.map(a => a.url),
  };

  // Add to the beginning of the list (index 0 is the newest)
  list.unshift(data);

  // Keep only the configured limit of deleted messages
  const maxLimit = getMaxLimit();
  if (list.length > maxLimit) {
    list.splice(maxLimit);
  }
}

/**
 * Retrieves a deleted message from cache by index (1-indexed for user CLI).
 */
export function getSnipe(channelId, index = 1) {
  const list = snipes.get(channelId);
  if (!list || list.length === 0) return null;

  const idx = index - 1; // 0-based indexing
  if (idx < 0 || idx >= list.length) return null;

  return {
    message: list[idx],
    totalCount: list.length,
  };
}

/**
 * Checks if a member is authorized to run the snipe command.
 * Access is granted if:
 * 1. Member is Moderator/Admin (default).
 * 2. Member's ID is in the custom allowed users list.
 * 3. Member has a role in the custom allowed roles list.
 */
export function canSnipe(member) {
  if (!member) return false;

  // 1. Default: Moderators and Admins
  if (checkPermission(member, 'moderator')) return true;

  const db = getDb();

  // 2. Check custom allowed users
  const userRow = db.prepare("SELECT value FROM bot_config WHERE key = 'snipe_allowed_users'").get();
  if (userRow && userRow.value) {
    const userIds = userRow.value.split(',').filter(Boolean);
    if (userIds.includes(member.id)) return true;
  }

  // 3. Check custom allowed roles
  const roleRow = db.prepare("SELECT value FROM bot_config WHERE key = 'snipe_allowed_roles'").get();
  if (roleRow && roleRow.value) {
    const roleIds = roleRow.value.split(',').filter(Boolean);
    const hasRole = roleIds.some(rId => member.roles.cache.has(rId));
    if (hasRole) return true;
  }

  return false;
}
