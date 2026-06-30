import { createV2Container, v2Payload, notification, field } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { checkPermission } from '../../helpers/permissions.js';
import { bumpManager } from '../../systems/bump/bumpManager.js';

const BUMP_COOLDOWN = 7200;

export default {
  name: 'bump',
  aliases: ['bumpremind', 'bumpreminder'],
  description: 'Configure bump reminders. Record a bump or manage the reminder system.',
  usage: '?bump [setup <#channel> [@role]] | [?bump record] | [?bump status] | [?bump remove]',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      if (!args.length) {
        return this.showStatus(message, client);
      }

      const sub = args[0].toLowerCase();

      if (sub === 'setup' || sub === 'set') {
        if (!checkPermission(message.member, 'admin')) {
          return message.reply({ ...v2Payload(notification('error', `${emojis.error} Only admins can set up bump reminders.`, client)), allowedMentions: { repliedUser: false } });
        }
        return this.handleSetup(message, args.slice(1), client);
      }

      if (sub === 'record' || sub === 'done') {
        return this.handleRecord(message, client);
      }

      if (sub === 'status' || sub === 'info') {
        return this.showStatus(message, client);
      }

      if (sub === 'remove' || sub === 'delete' || sub === 'disable') {
        if (!checkPermission(message.member, 'admin')) {
          return message.reply({ ...v2Payload(notification('error', `${emojis.error} Only admins can remove bump reminders.`, client)), allowedMentions: { repliedUser: false } });
        }
        return this.handleRemove(message, client);
      }

      return sendUsageError(message, this.usage);
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async handleSetup(message, args, client) {
    const channel = message.mentions.channels?.first();
    if (!channel) return sendUsageError(message, '?bump setup <#channel> [@role]');

    const role = message.mentions.roles?.first() || null;

    bumpManager.setConfig(message.guild.id, channel.id, role?.id || null);

    const lines = [
      `### ⬆️ Bump Reminder Configured`,
      `**Channel:** <#${channel.id}>`,
      role ? `**Ping Role:** <@&${role.id}>` : '**Ping Role:** @everyone',
      '',
      `Reminders will be sent every 2 hours if no bump is recorded.`,
      `Users can use \`?bump record\` after bumping on DISBOARD.`,
    ];

    const container = createV2Container({ description: lines.join('\n'), color: config.colors.success, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },

  async handleRecord(message, client) {
    const cfg = bumpManager.getConfig(message.guild.id);
    if (!cfg) {
      return message.reply({ ...v2Payload(notification('warning', `${emojis.warning} Bump reminders are not configured here.`, client)), allowedMentions: { repliedUser: false } });
    }

    bumpManager.recordBump(message.guild.id);

    const lines = [
      `### ⬆️ Bump Recorded!`,
      `Thanks for bumping, ${message.author}!`,
      `Next reminder will be in about 2 hours.`,
    ];

    const container = createV2Container({ description: lines.join('\n'), color: config.colors.success, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },

  async showStatus(message, client) {
    const cfg = bumpManager.getConfig(message.guild.id);

    if (!cfg) {
      const lines = [
        `### ⬆️ Bump Reminders`,
        `Not configured.`,
        '',
        `An admin can set it up with:`,
        `\`?bump setup <#channel> [@role]\``,
      ];
      return message.reply({ ...v2Payload(createV2Container({ description: lines.join('\n'), color: config.colors.primary, client })), allowedMentions: { repliedUser: false } });
    }

    const lastBump = cfg.last_bump_time;
    const now = Math.floor(Date.now() / 1000);
    const sinceLast = lastBump ? now - lastBump : null;
    const canBump = sinceLast ? sinceLast >= BUMP_COOLDOWN : true;

    const lines = [
      `### ⬆️ Bump Status`,
      field('Channel', `<#${cfg.channel_id}>`),
      field('Ping Role', cfg.role_id ? `<@&${cfg.role_id}>` : '@everyone'),
      field('Enabled', cfg.enabled ? 'Yes' : 'No'),
      lastBump ? field('Last Bump', `<t:${lastBump}:R>`) : '**Last Bump:** Never',
      '',
      canBump ? `${emojis.success} **Ready to bump!** Use \`?bump record\` after bumping.` : `⏳ ${Math.ceil((BUMP_COOLDOWN - sinceLast) / 60)}m until next reminder.`,
    ];

    const container = createV2Container({ description: lines.join('\n'), color: canBump ? config.colors.warning : config.colors.primary, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },

  async handleRemove(message, client) {
    bumpManager.removeConfig(message.guild.id);
    const container = createV2Container({ description: 'Bump reminders removed for this server.', color: config.colors.success, client });
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },
};
