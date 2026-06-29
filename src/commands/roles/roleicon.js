import { createV2Container, v2Payload, notification, paginationRow, relativeTime } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { checkPermission } from '../../helpers/permissions.js';

const ROLES_PER_PAGE = 15;

export default {
  name: 'roleicon',
  aliases: ['roleemoji', 'rolesticker', 'ri', 're'],
  description: 'Manage role icons, emojis, and stickers.',
  usage: '?roleicon <set|remove|preview> <role> [icon|emoji|sticker|url]',
  permission: 'admin',
  examples: [
    '?roleicon set @Moderator 🛡️',
    '?roleicon set @VIP <:custom_emoji:123>',
    '?roleicon set @Staff https://i.imgur.com/icon.png',
    '?roleicon remove @Moderator',
    '?roleicon preview @Moderator',
  ],

  async execute(message, args, client) {
    try {
      if (!args.length) {
        return this.sendHelp(message, client);
      }

      const sub = args[0].toLowerCase();
      const rest = args.slice(1);

      switch (sub) {
        case 'set':
          return this.handleSet(message, rest, client);
        case 'remove':
        case 'delete':
          return this.handleRemove(message, rest, client);
        case 'preview':
        case 'view':
          return this.handlePreview(message, rest, client);
        case 'list':
          return this.handleList(message, rest, client);
        default:
          return this.sendHelp(message, client);
      }
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async sendHelp(message, client) {
    const content = [
      `### 🎨 Role Icon Manager`,
      `Manage icons, emojis, and stickers on roles.`,
      '',
      `### 📋 Commands`,
      `• \`?roleicon set <role> <emoji|url>\` — Set a role icon`,
      `• \`?roleicon remove <role>\` — Remove the role icon`,
      `• \`?roleicon preview <role>\` — Preview role appearance`,
      `• \`?roleicon list\` — List all roles with custom icons`,
      '',
      `**Example:** \`?roleicon set @Moderator 🛡️\``,
    ].join('\n');

    const container = createV2Container({
      description: content,
      color: config.colors.primary,
      client,
    });

    await message.reply({
      ...v2Payload(container),
      allowedMentions: { repliedUser: false },
    });
  },

  resolveRole(guild, query) {
    const id = query.replace(/[<@&>]/g, '');
    return guild.roles.cache.get(id) || null;
  },

  async handleSet(message, args, client) {
    if (args.length < 2) {
      return sendUsageError(message, '?roleicon set <role> <emoji|url>');
    }

    const role = this.resolveRole(message.guild, args[0]);
    if (!role) {
      const card = notification('error', `❌ Role not found: \`${args[0]}\``, client);
      return message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    }

    // Check hierarchy
    if (role.position >= message.member.roles.highest.position && !checkPermission(message.member, 'admin')) {
      const card = notification('error', `❌ That role is higher than your highest role.`, client);
      return message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    }

    const iconInput = args.slice(1).join(' ').trim();

    try {
      if (iconInput.startsWith('http://') || iconInput.startsWith('https://')) {
        await role.setIcon(iconInput, `Icon set by ${message.author.tag}`);
      } else {
        // Try as unicode emoji or custom emoji
        await role.setUnicodeEmoji(iconInput);
      }

      const card = notification('success', [
        `✅ **Role icon updated!**`,
        `<@&${role.id}> → ${iconInput}`,
      ], client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    } catch (err) {
      const card = notification('error', `❌ Failed to set icon: ${err.message}`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    }
  },

  async handleRemove(message, args, client) {
    if (!args.length) {
      return sendUsageError(message, '?roleicon remove <role>');
    }

    const role = this.resolveRole(message.guild, args[0]);
    if (!role) {
      const card = notification('error', `❌ Role not found: \`${args[0]}\``, client);
      return message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    }

    try {
      await role.setIcon(null);
      const card = notification('success', `✅ Icon removed from <@&${role.id}>.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    } catch (err) {
      const card = notification('error', `❌ Failed to remove icon: ${err.message}`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    }
  },

  async handlePreview(message, args, client) {
    if (!args.length) {
      return sendUsageError(message, '?roleicon preview <role>');
    }

    const role = this.resolveRole(message.guild, args[0]);
    if (!role) {
      const card = notification('error', `❌ Role not found: \`${args[0]}\``, client);
      return message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    }

      const lines = [
        `### 🏆 Role Preview`,
      `**Name:** ${role.name}`,
      `**ID:** \`${role.id}\``,
      `**Color:** ${role.hexColor}`,
      `**Icon:** ${role.icon ? `[Icon URL](${role.iconURL({ size: 64 })})` : '*None*'}`,
      `**Emoji:** ${role.unicodeEmoji || '*None*'}`,
      `**Position:** ${role.position}`,
      `**Mention:** <@&${role.id}>`,
      `**Created:** ${relativeTime(Math.floor(role.createdTimestamp / 1000))}`,
    ].join('\n');

    const container = createV2Container({
      description: lines,
      color: role.color || config.colors.primary,
      thumbnail: role.iconURL({ size: 128 }) || undefined,
      client,
    });

    await message.reply({
      ...v2Payload(container),
      allowedMentions: { repliedUser: false },
    });
  },

  async handleList(message, args, client) {
    const roles = [...message.guild.roles.cache.values()]
      .filter(r => r.icon || r.unicodeEmoji)
      .sort((a, b) => b.position - a.position);

    if (roles.length === 0) {
      const card = notification('info', `*No roles with custom icons or emojis.*`, client);
      return message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    }

    const page = parseInt(args[0], 10) || 1;
    const totalPages = Math.ceil(roles.length / ROLES_PER_PAGE);
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * ROLES_PER_PAGE;
    const pageRoles = roles.slice(start, start + ROLES_PER_PAGE);

    const lines = [`### 🎨 Roles with Custom Icons`];
    for (const r of pageRoles) {
      const indicator = r.icon ? '🖼️' : r.unicodeEmoji ? '🔤' : '';
      lines.push(`${indicator} <@&${r.id}> — ${r.unicodeEmoji || ''}`);
    }

    const container = createV2Container({
      description: lines.join('\n'),
      color: config.colors.primary,
      client,
    });

    const ext = totalPages > 1 ? [paginationRow('roleicon_list', safePage, totalPages, message.author.id)] : [];
    await message.reply({
      ...v2Payload(container, ext),
      allowedMentions: { repliedUser: false },
    });
  },
};