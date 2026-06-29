import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createV2Container, v2Payload, notification, codeStat } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { botConfig } from '../../helpers/configHelper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { checkPermission } from '../../helpers/permissions.js';
import { jailManager } from '../../systems/jail/jailManager.js';
import { moderationManager } from '../../systems/moderation/moderationManager.js';

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
  if (!seconds) return 'Permanent';
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
  name: 'jail',
  aliases: ['j'],
  description: 'Jail system — detain, release, and manage jailed users.',
  usage: '?jail <@user> [duration] [reason] | ?jail release <@user> | ?jail dashboard | ?jail history <@user>',
  permission: 'admin',

  async execute(message, args, client) {
    try {
      if (!args.length) {
        return this.showDashboard(message, client);
      }

      const sub = args[0].toLowerCase();

      if (sub === 'release' || sub === 'unjail' || sub === 'free') {
        if (!checkPermission(message.member, 'admin')) {
          const card = notification('error', `❌ Only admins can release users.`, client);
          const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
          setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
          return;
        }
        return this.handleRelease(message, args.slice(1), client);
      }

      if (sub === 'dashboard' || sub === 'stats') {
        return this.showDashboard(message, client);
      }

      if (sub === 'history' || sub === 'logs') {
        const target = message.mentions.members?.first() || message.member;
        return this.showHistory(message, target, client);
      }

      if (sub === 'appeal') {
        return this.handleAppeal(message, args.slice(1), client);
      }

      // Default: jail a user
      return this.handleJail(message, args, client);
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async handleJail(message, args, client) {
    // Validate jail config
    const jailRoleId = botConfig.jailRoleId;
    if (!jailRoleId) {
      const card = notification('error', `❌ Jail role is not configured. Use \`?config\` to set a jail role first.`, client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
      return;
    }
    const jailRole = message.guild.roles.cache.get(jailRoleId);
    if (!jailRole) {
      const card = notification('error', `❌ Configured jail role no longer exists. Use \`?config\` to set a valid jail role.`, client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
      return;
    }

    const target = message.mentions.members?.first();
    if (!target) return sendUsageError(message, '?jail <@user> [duration] [reason]');

    if (target.id === message.author.id) {
      const card = notification('error', `❌ You cannot jail yourself.`, client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
      return;
    }

    if (checkPermission(target, 'admin')) {
      const card = notification('error', `❌ You cannot jail another admin.`, client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
      return;
    }

    if (jailManager.isJailed(target.id)) {
      const card = notification('warning', `⚠️ ${target} is already jailed.`, client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
      return;
    }

    let duration = null;
    let reasonStart = 1;

    // Check if second arg is a duration
    if (args.length > 1) {
      const parsed = parseDuration(args[1]);
      if (parsed) {
        duration = parsed;
        reasonStart = 2;
      }
    }

    const reason = args.slice(reasonStart).join(' ') || 'No reason provided';

    try {
      await jailManager.jail(target, message.member, reason, duration);

      const lines = [
        `⛓️ **${target.user.tag}** has been jailed.`,
        reason ? `**Reason:** ${reason}` : '',
        duration ? `**Duration:** ${formatDuration(duration)}` : '**Duration:** Permanent',
        '',
        `> Make sure the jail role has \`ViewChannel\` denied on all channels except the jail channel.`,
      ].filter(Boolean).join('\n');

      moderationManager.logCase(message.guild.id, 'JAIL', message.author.id, target.id, reason, duration);

      const card = notification('success', lines, client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);

      // DM the user
      const dmLines = [
        `### ⛓️ You have been jailed in ${message.guild.name}`,
        reason ? `**Reason:** ${reason}` : '',
        duration ? `**Duration:** ${formatDuration(duration)}` : '**Duration:** Permanent',
        '',
        duration ? 'You will be automatically released when your time is up.' : 'An admin must release you.',
      ].filter(Boolean).join('\n');

      const dmCard = createV2Container({
        description: dmLines,
        color: config.colors.jail,
        client,
      });
      await target.send(v2Payload(dmCard)).catch(() => null);

    } catch (err) {
      logger.error('JAIL', `Failed to jail: ${err.message}`, err);
      const card = notification('error', `❌ Failed to jail user: ${err.message}`, client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
    }
  },

  async handleRelease(message, args, client) {
    const target = message.mentions.members?.first();
    if (!target) return sendUsageError(message, '?jail release <@user>');

    if (!jailManager.isJailed(target.id)) {
      const card = notification('warning', `⚠️ ${target} is not currently jailed.`, client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
      return;
    }

    try {
      await jailManager.unjail(target, message.member);
      moderationManager.logCase(message.guild.id, 'UNJAIL', message.author.id, target.id, `Released by ${message.author.tag}`);

      const card = notification('success', `✅ **${target.user.tag}** has been released from jail.`, client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);

      await target.send(v2Payload(notification('info', `ℹ️ You have been released from jail in ${message.guild.name}.`, client))).catch(() => null);
    } catch (err) {
      const card = notification('error', `❌ Failed to release: ${err.message}`, client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
    }
  },

  async showDashboard(message, client) {
    const stats = jailManager.getStats();
    const active = jailManager.getActiveAll();
    const due = jailManager.getDueForRelease();

    const lines = [
      `### ⛓️ Jail Dashboard`,
      '',
      codeStat('Currently Jailed', stats.active),
      codeStat('Total Cases', stats.total),
      codeStat('Jailed Today', stats.today),
      codeStat('Released Today', stats.released),
      due.length > 0 ? codeStat('Due for Release', due.length) : '',
      '',
      active.length > 0 ? '**Current Population:**' : '*No one is jailed.*',
    ].filter(Boolean).join('\n');

    const popLines = active.slice(0, 10).map((r, i) => {
      const remaining = r.duration ? formatDuration(r.duration - (Math.floor(Date.now() / 1000) - r.jailed_at)) : 'Permanent';
      return `${i + 1}. <@${r.user_id}> — ${remaining}`;
    });

    const fullLines = [lines, '', ...popLines].join('\n');

    const container = createV2Container({
      description: fullLines,
      color: config.colors.jail,
      client,
    });

    let components = [];
    if (active.length > 0) {
      const refreshBtn = new ButtonBuilder()
        .setCustomId(`jail:refresh:${message.author.id}`)
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.loading);
      components.push(new ActionRowBuilder().addComponents(refreshBtn));
    }

    await message.reply({
      ...v2Payload(container, components),
      allowedMentions: { repliedUser: false },
    });
  },

  async showHistory(message, target, client) {
    const history = jailManager.getHistory(target.id, 10);

    if (history.length === 0) {
      const card = notification('info', `ℹ️ No jail history for ${target}.`, client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
      return;
    }

    const lines = [
      `### ⛓️ Jail History — ${target.user.tag}`,
      '',
      ...history.map((r, i) => {
        const dur = r.duration ? formatDuration(r.duration) : 'Permanent';
        const status = r.active ? `❌ Active` : `✅ Released`;
        return `**#${i + 1}** ${status}\n> ${r.reason || 'No reason'} — <t:${r.jailed_at}:R>${r.active ? '' : ` by <@${r.unjailed_by}>`}`;
      }),
    ].join('\n');

    const container = createV2Container({
      description: lines,
      color: config.colors.jail,
      client,
    });

    await message.reply({
      ...v2Payload(container),
      allowedMentions: { repliedUser: false },
    });
  },

  async handleAppeal(message, args, client) {
    // Appeal — user appeals their jail
    if (message.mentions.members?.first()) {
      // Admin viewing an appeal
      if (!checkPermission(message.member, 'admin')) {
        const card = notification('error', `❌ Only admins can view appeals.`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }
      const target = message.mentions.members.first();
      const history = jailManager.getHistory(target.id, 1);
      if (history.length === 0 || !history[0].active) {
        const card = notification('info', `ℹ️ ${target} is not currently jailed.`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }
      const card = notification('info', [
        `### ⚖️ Appeal for ${target.user.tag}`,
        `**Case:** Jailed <t:${history[0].jailed_at}:R>`,
        `**Reason:** ${history[0].reason || 'No reason'}`,
        `**Moderator:** <@${history[0].moderator_id}>`,
        '',
        `Use \`?jail release ${target}\` to release them.`,
      ].join('\n'), client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
      return;
    }

    // User appealing their own jail
    const active = jailManager.isJailed(message.author.id);
    if (!active) {
      const card = notification('info', `ℹ️ You are not currently jailed.`, client);
      const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
      return;
    }

    const card = notification('info', [
      `### ⚖️ Appeal Submitted`,
      `Your appeal has been noted. An admin will review it.`,
      '',
      `*This is a placeholder — in production this would DM all mods.*`,
    ].join('\n'), client);
    const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);

    // Notify admins
    const admins = message.guild.members.cache.filter(m => checkPermission(m, 'admin'));
    for (const admin of admins.values()) {
      await admin.send(v2Payload(notification('warning', `⚖️ **Appeal from ${message.author.tag}**\nThey are currently jailed and requesting release.`, client))).catch(() => null);
    }
  },
};

// Import logger for error handling
import { logger } from '../../helpers/logger.js';
