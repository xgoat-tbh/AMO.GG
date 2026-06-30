import { createV2Container, v2Payload, notification, codeStat, relativeTime } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { checkPermission } from '../../helpers/permissions.js';
import { tempRoleManager } from '../../systems/temprole/tempRoleManager.js';
import { logger } from '../../helpers/logger.js';

function parseDuration(text) {
  if (!text) return null;
  const match = text.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return num * (multipliers[unit] || 1);
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

export default {
  name: 'temprole',
  aliases: ['temproles', 'tr'],
  description: 'Assign or manage temporary roles that auto-expire.',
  usage: '?temprole <@user> <@role> <duration> [reason] | ?temprole list [@user] | ?temprole remove <@user>',
  permission: 'moderator',

  async execute(message, args, client) {
    try {
      if (!args.length) {
        return sendUsageError(message, this.usage);
      }

      const sub = args[0].toLowerCase();

      if (sub === 'list' || sub === 'show') {
        return this.handleList(message, args.slice(1), client);
      }

      if (sub === 'remove' || sub === 'clear') {
        return this.handleRemove(message, args.slice(1), client);
      }

      return this.handleAssign(message, args, client);
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async handleAssign(message, args, client) {
    const target = message.mentions.members?.first();
    if (!target) return sendUsageError(message, '?temprole <@user> <@role> <duration>');

    if (target.id === message.author.id) {
      return message.reply({ ...v2Payload(notification('error', `${emojis.error} You cannot assign a temp role to yourself.`, client)), allowedMentions: { repliedUser: false } });
    }

    const role = message.mentions.roles?.first();
    if (!role) return sendUsageError(message, '?temprole <@user> <@role> <duration>');

    if (role.managed || role.id === message.guild.roles.everyone.id) {
      return message.reply({ ...v2Payload(notification('error', `${emojis.error} Cannot use that role as a temporary role.`, client)), allowedMentions: { repliedUser: false } });
    }

    const durationStr = args.find(a => /^\d+[smhd]$/.test(a));
    if (!durationStr) return sendUsageError(message, '?temprole <@user> <@role> <duration>');

    const duration = parseDuration(durationStr);
    if (!duration || duration < 60) {
      return message.reply({ ...v2Payload(notification('warning', `${emojis.warning} Duration must be at least 1 minute.`, client)), allowedMentions: { repliedUser: false } });
    }

    if (duration > 2592000) {
      return message.reply({ ...v2Payload(notification('warning', `${emojis.warning} Duration cannot exceed 30 days.`, client)), allowedMentions: { repliedUser: false } });
    }

    if (message.guild.roles.highest.position <= role.position && message.author.id !== message.guild.ownerId) {
      return message.reply({ ...v2Payload(notification('error', `${emojis.error} That role is higher than your highest role.`, client)), allowedMentions: { repliedUser: false } });
    }

    try {
      await tempRoleManager.assignTempRole(target, role, duration, message.author);

      const lines = [
        `### ⏳ Temporary Role Assigned`,
        `**User:** ${target.user.tag} (<@${target.id}>)`,
        `**Role:** <@&${role.id}>`,
        `**Duration:** ${formatDuration(duration)}`,
        `**Expires:** <t:${Math.floor(Date.now() / 1000) + duration}:R>`,
      ];

      const container = createV2Container({ description: lines.join('\n'), color: config.colors.success, client });
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
    } catch (err) {
      logger.error('TEMPROLE', `Failed to assign temp role: ${err.message}`);
      await message.reply({ ...v2Payload(notification('error', `${emojis.error} Failed to assign: ${err.message}`, client)), allowedMentions: { repliedUser: false } });
    }
  },

  async handleList(message, args, client) {
    const target = message.mentions.members?.first() || message.member;
    const records = tempRoleManager.getActiveForUser(target.id, message.guild.id);

    if (!records.length) {
      return message.reply({ ...v2Payload(notification('info', `${emojis.info} ${target.user.tag} has no active temporary roles.`, client)), allowedMentions: { repliedUser: false } });
    }

    const lines = [
      `### ⏳ Active Temporary Roles — ${target.user.tag}`,
      '',
      ...records.map((r, i) =>
        `${i + 1}. <@&${r.role_id}> — expires <t:${r.expires_at}:R>`
      ),
    ];

    const container = createV2Container({ description: lines.join('\n'), color: config.colors.primary, thumbnail: target.user.displayAvatarURL(), client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },

  async handleRemove(message, args, client) {
    const target = message.mentions.members?.first();
    if (!target) return sendUsageError(message, '?temprole remove <@user>');

    const records = await tempRoleManager.removeAllForUser(target);
    if (!records.length) {
      return message.reply({ ...v2Payload(notification('info', `${emojis.info} ${target.user.tag} has no temporary roles.`, client)), allowedMentions: { repliedUser: false } });
    }

    const container = createV2Container({ description: `Removed **${records.length}** temporary role(s) from ${target.user.tag}.`, color: config.colors.success, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },
};
