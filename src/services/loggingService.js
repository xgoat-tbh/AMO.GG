import { botConfig as config } from '../helpers/configHelper.js';
import { createV2Container, v2Payload } from '../helpers/v2Helper.js';
import { assets } from '../config/assets.config.js';
import { emojis } from '../config/emojis.config.js';
import { logger } from '../helpers/logger.js';

/**
 * Safely fetch a text channel by ID.
 * Returns null if the channel ID is not configured or the channel cannot be found.
 */
async function getLogChannel(client, channelId) {
  if (!channelId) return null;
  try {
    return await client.channels.fetch(channelId);
  } catch {
    logger.warn('LOG', `Could not fetch log channel: ${channelId}`);
    return null;
  }
}

/**
 * Send a container to a log channel. Silently skips if channel is unavailable.
 */
async function sendLog(client, channelId, container) {
  const channel = await getLogChannel(client, channelId);
  if (!channel) return;

  try {
    await channel.send(v2Payload(container));
  } catch (error) {
    logger.warn('LOG', `Failed to send log to ${channelId}: ${error.message}`);
  }
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Log a moderation action (jail, unjail, ban, kick, etc.).
 */
export async function logModeration(client, { action, moderator, target, reason, extra }) {
  const fields = [
    { name: 'Action', value: action },
    { name: 'Moderator', value: `<@${moderator.id}> (${moderator.tag || moderator.user?.tag || moderator.id})` },
  ];

  if (target) {
    fields.push({
      name: 'Target',
      value: `<@${target.id}> (${target.tag || target.user?.tag || target.id})`,
    });
  }

  if (reason) {
    fields.push({ name: 'Reason', value: reason });
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      fields.push({ name: key, value: String(value) });
    }
  }

  const container = createV2Container({
    title: `🛡️ Moderation — ${action}`,
    color: config.colors.warning,
    fields,
    thumbnail: assets.moderation,
    client,
  });

  await sendLog(client, config.channels.logs.moderation, container);
}

/**
 * Log a voice action (mute, deafen, lockdown, etc.).
 */
export async function logVoice(client, { action, moderator, target, channel, extra }) {
  const fields = [
    { name: 'Action', value: action },
    { name: 'Moderator', value: `<@${moderator.id}>` },
  ];

  if (target) {
    fields.push({ name: 'Target', value: String(target) });
  }

  if (channel) {
    fields.push({ name: 'Channel', value: `<#${channel.id || channel}>` });
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      fields.push({ name: key, value: String(value) });
    }
  }

  const container = createV2Container({
    title: `🔊 Voice — ${action}`,
    color: config.colors.voice,
    fields,
    thumbnail: assets.voice,
    client,
  });

  await sendLog(client, config.channels.logs.voice, container);
}

/**
 * Log a role action (toggle, bulk add/remove, etc.).
 */
export async function logRole(client, { action, moderator, target, role, extra }) {
  const fields = [
    { name: 'Action', value: action },
    { name: 'Moderator', value: `<@${moderator.id}>` },
  ];

  if (target) {
    fields.push({ name: 'Target', value: String(target) });
  }

  if (role) {
    fields.push({ name: 'Role', value: `<@&${role.id || role}>` });
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      fields.push({ name: key, value: String(value) });
    }
  }

  const container = createV2Container({
    title: `🎭 Roles — ${action}`,
    color: config.colors.primary,
    fields,
    thumbnail: assets.ticket,
    client,
  });

  await sendLog(client, config.channels.logs.roles, container);
}

/**
 * Log a confession (ALWAYS includes full author details, even for anonymous confessions).
 */
export async function logConfession(client, { author, content, type, messageId }) {
  const fields = [
    { name: 'Type', value: type === 'anonymous' ? '🕵️ Anonymous' : '👤 Known' },
    { name: 'Author', value: `<@${author.id}> (${author.tag || author.user?.tag || author.id})` },
    { name: 'Author ID', value: author.id },
  ];

  if (messageId) {
    fields.push({ name: 'Message ID', value: messageId });
  }

  // Truncate content for container if needed (max 1024 for field value)
  const displayContent = content.length > 1024 ? content.slice(0, 1021) + '...' : content;
  fields.push({ name: 'Content', value: displayContent });

  const container = createV2Container({
    title: `📝 Confession Log`,
    color: config.colors.confession,
    fields,
    thumbnail: assets.confession,
    client,
  });

  await sendLog(client, config.channels.logs.confessions, container);
}

/**
 * Log a suggestion event (create, status change, etc.).
 */
export async function logSuggestion(client, { action, author, content, extra }) {
  const fields = [
    { name: 'Action', value: action },
  ];

  if (author) {
    fields.push({
      name: 'Author',
      value: `<@${author.id}> (${author.tag || author.user?.tag || author.id})`,
    });
  }

  if (content) {
    const displayContent = content.length > 1024 ? content.slice(0, 1021) + '...' : content;
    fields.push({ name: 'Content', value: displayContent });
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      fields.push({ name: key, value: String(value) });
    }
  }

  const container = createV2Container({
    title: `💡 Suggestion — ${action}`,
    color: config.colors.suggestion,
    fields,
    thumbnail: assets.suggestion,
    client,
  });

  await sendLog(client, config.channels.logs.suggestions, container);
}

/**
 * Log a gameping execution.
 */
export async function logGamePing(client, { executor, alias, role, channel }) {
  const fields = [
    { name: 'Executor', value: `<@${executor.id}> (${executor.tag || executor.user?.tag || executor.id})` },
    { name: 'Alias', value: alias },
  ];

  if (role) {
    fields.push({ name: 'Role', value: `<@&${role}>` });
  }

  if (channel) {
    fields.push({ name: 'Channel', value: `<#${channel.id || channel}>` });
  }

  const container = createV2Container({
    title: `🎮 GamePing Executed`,
    color: config.colors.info,
    fields,
    thumbnail: assets.voice,
    client,
  });

  await sendLog(client, config.channels.logs.gameping, container);
}

/**
 * Log a Creator System action (setup, repairs, config updates).
 */
export async function logCreatorSetup(client, { action, details, executor }) {
  const fields = [
    { name: 'Action', value: action },
    { name: 'Details', value: details },
  ];
  if (executor) {
    fields.push({ name: 'Executor', value: `<@${executor.id}> (${executor.tag || executor.username || executor.id})` });
  }

  const container = createV2Container({
    title: `⚙️ Creator System — ${action}`,
    color: config.colors.primary,
    fields,
    client,
  });

  await sendLog(client, config.channels.log || config.channels.logs.moderation, container);
}

/**
 * Log a configuration change (admin overrides).
 */
export async function logConfigChange(client, { action, setting, oldValue, newValue, executor }) {
  const fields = [
    { name: 'Action', value: action || 'updated' },
    { name: 'Setting', value: `\`${setting}\`` },
  ];
  if (oldValue !== undefined) {
    fields.push({ name: 'Previous Value', value: `\`${oldValue || 'none'}\`` });
  }
  fields.push({ name: 'New Value', value: `\`${newValue || 'none'}\`` });
  if (executor) {
    fields.push({ name: 'Executor', value: `<@${executor.id}> (${executor.tag || executor.id})` });
  }

  const container = createV2Container({
    title: `⚙️ Configuration Change`,
    color: config.colors.warning,
    fields,
    thumbnail: assets.ticket,
    client,
  });

  await sendLog(client, config.channels.log || config.channels.logs.moderation, container);
  logger.info('CONFIG_AUDIT', `${executor?.id || 'unknown'} ${action || 'updated'} "${setting}" from "${oldValue || 'none'}" to "${newValue || 'none'}"`);
}
