import { getDb } from '../../database/connection.js';
import { BoosterRepo } from '../../database/repositories/booster.repo.js';
import { createV2Container, v2Payload, paginationRow, notification } from '../../helpers/v2Helper.js';
import { checkPermission } from '../../helpers/permissions.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { assets } from '../../config/assets.config.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

const CMDS_PER_PAGE = 10;

export default {
  name: 'bb',
  aliases: ['booster', 'boost', 'rolelist'],
  description: 'Manage personal custom booster roles.',
  usage: '?bb <claim | color | name | icon | delete | list | setup> [args]',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      if (!args.length) {
        return this.sendHelp(message, client);
      }

      const subcommand = args[0].toLowerCase();

      switch (subcommand) {
        case 'setup':
          return await this.handleSetup(message, args.slice(1), client);
        case 'claim':
          return await this.handleClaim(message, client);
        case 'color':
          return await this.handleColor(message, args.slice(1), client);
        case 'name':
          return await this.handleName(message, args.slice(1), client);
        case 'icon':
          return await this.handleIcon(message, args.slice(1), client);
        case 'delete':
          return await this.handleDelete(message, client);
        case 'list':
        case 'rolelist':
          return await this.handleList(message, args.slice(1), client);
        default:
          return this.sendHelp(message, client);
      }
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async sendHelp(message, client) {
    const content = [
      `### 🚀 Booster Role Manager`,
      `Manage your personal custom booster role.`,
      '',
      `### 📋 Commands`,
      `• \`?bb claim\` — Claim your personal booster role`,
      `• \`?bb color <hex>\` — Change role color (e.g. \`#FF0000\`)`,
      `• \`?bb name <name>\` — Rename your role`,
      `• \`?bb icon <emoji|url>\` — Set role icon *(Boost Lv.2)*`,
      `• \`?bb delete\` — Delete your role`,
      `• \`?bb list\` — View all claimed roles`,
      '',
      `### ⚙️ Admin`,
      `• \`?bb setup <role>\` — Set base role for creation`,
    ].join('\n');

    const container = createV2Container({
      description: content,
      color: config.colors.primary,
      thumbnail: assets.voice,
      client,
    });

    await message.reply({
      ...v2Payload(container),
      allowedMentions: { repliedUser: false },
    });
  },

  async handleSetup(message, args, client) {
    const isAdmin = checkPermission(message.member, 'admin');
    if (!isAdmin) {
      const card = notification('error', `❌ Only Administrators can configure the booster system.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    if (!args.length) {
      return sendUsageError(message, '?bb setup <@role | role_id>');
    }

    const query = args[0];
    const roleId = query.replace(/[<@&>]/g, '');
    const role = message.guild.roles.cache.get(roleId);

    if (!role) {
      const card = notification('error', `❌ Role not found. Mention a valid role or provide its ID.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    const db = getDb();
    db.prepare(
      "INSERT OR REPLACE INTO bot_config (key, value) VALUES ('booster_base_role', ?)"
    ).run(role.id);

    const card = notification('success', `✅ **Booster base role established to <@&${role.id}>.**`, client);
    await message.reply({
      ...v2Payload(card),
      allowedMentions: { repliedUser: false },
    });
  },

  async handleClaim(message, client) {
    const db = getDb();

    const baseRoleRow = db.prepare("SELECT value FROM bot_config WHERE key = 'booster_base_role'").get();
    if (!baseRoleRow || !baseRoleRow.value) {
      const card = notification('error', `❌ The booster base role has not been set by an Administrator yet.\nUse \`?bb setup <role>\` first.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    const baseRole = message.guild.roles.cache.get(baseRoleRow.value);
    if (!baseRole) {
      const card = notification('error', `❌ Configured base role no longer exists. Contact an Administrator.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    const nativeBoosterRole = message.guild.roles.cache.find(r => r.tags && r.tags.premiumSubscriberRole);
    const isPremium = message.member.premiumSince !== null ||
                      (nativeBoosterRole && message.member.roles.cache.has(nativeBoosterRole.id));
    const isAdmin = checkPermission(message.member, 'admin');

    if (!isPremium && !isAdmin) {
      const card = notification('error', `❌ Only server boosters can claim custom roles.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    let claimed = BoosterRepo.get(db, message.author.id);
    if (claimed) {
      const existingRole = message.guild.roles.cache.get(claimed.role_id);
      if (existingRole) {
        const card = notification('error', `❌ You already have a claimed booster role: <@&${existingRole.id}>.`, client);
        await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        return;
      }
      BoosterRepo.delete(db, message.author.id);
    }

    try {
      const defaultName = `${message.member.displayName || message.author.username}'s Role`;
      const newRole = await message.guild.roles.create({
        name: defaultName,
        color: '#FFFFFF',
        reason: `Custom booster role claimed by ${message.author.tag}`,
      });

      await newRole.setPosition(baseRole.position + 1).catch(err => {
        logger.warn('BOOSTER', `Failed to adjust role position: ${err.message}`);
      });

      await message.member.roles.add(newRole);
      BoosterRepo.create(db, message.author.id, newRole.id);

      const card = notification('success', [
        `✅ **Personal booster role claimed!**`,
        `• Role: <@&${newRole.id}>`,
        `• Use \`?bb color\` and \`?bb name\` to customize.`,
      ], client);
      await message.reply({
        ...v2Payload(card),
        allowedMentions: { repliedUser: false },
      });
    } catch (err) {
      logger.error('BOOSTER', `Error creating custom role: ${err.message}`, err);
      const card = notification('error', `❌ Failed to create role. Ensure the bot has "Manage Roles" permission.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    }
  },

  async handleColor(message, args, client) {
    if (!args.length) {
      return sendUsageError(message, '?bb color <hex_color>');
    }

    const hex = args[0].trim();
    const hexRegex = /^#?[0-9a-fA-F]{6}$/;
    if (!hexRegex.test(hex)) {
      const card = notification('error', `❌ Invalid hex color. Use e.g. \`#FF0000\`.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    const db = getDb();
    const claimed = BoosterRepo.get(db, message.author.id);
    if (!claimed) {
      const card = notification('error', `❌ You do not have a custom booster role. Use \`?bb claim\` first.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    const role = message.guild.roles.cache.get(claimed.role_id);
    if (!role) {
      BoosterRepo.delete(db, message.author.id);
      const card = notification('error', `❌ Your claimed role was deleted. Use \`?bb claim\` to create a new one.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    try {
      await role.setColor(hex);
      const card = notification('success', `✅ Changed your role color to \`${hex}\`.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    } catch (err) {
      const card = notification('error', `❌ Failed to change color: ${err.message}`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    }
  },

  async handleName(message, args, client) {
    if (!args.length) {
      return sendUsageError(message, '?bb name <new_name>');
    }

    const name = args.join(' ').trim();
    if (name.length < 1 || name.length > 32) {
      const card = notification('error', `❌ Role name must be between 1 and 32 characters.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    const db = getDb();
    const claimed = BoosterRepo.get(db, message.author.id);
    if (!claimed) {
      const card = notification('error', `❌ You do not have a custom booster role. Use \`?bb claim\` first.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    const role = message.guild.roles.cache.get(claimed.role_id);
    if (!role) {
      BoosterRepo.delete(db, message.author.id);
      const card = notification('error', `❌ Your claimed role was deleted. Use \`?bb claim\` to create a new one.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    try {
      await role.setName(name);
      const card = notification('success', `✅ Changed your role name to **"${name}"**.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    } catch (err) {
      const card = notification('error', `❌ Failed to change name: ${err.message}`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    }
  },

  async handleIcon(message, args, client) {
    if (!args.length) {
      return sendUsageError(message, '?bb icon <emoji | image_url>');
    }

    const iconInput = args[0].trim();

    const db = getDb();
    const claimed = BoosterRepo.get(db, message.author.id);
    if (!claimed) {
      const card = notification('error', `❌ You do not have a custom booster role. Use \`?bb claim\` first.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    const role = message.guild.roles.cache.get(claimed.role_id);
    if (!role) {
      BoosterRepo.delete(db, message.author.id);
      const card = notification('error', `❌ Your claimed role was deleted. Use \`?bb claim\` to create a new one.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    try {
      if (iconInput.startsWith('http://') || iconInput.startsWith('https://')) {
        await role.setIcon(iconInput);
      } else {
        await role.setUnicodeEmoji(iconInput);
      }

      const card = notification('success', `✅ Updated your custom role icon.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    } catch (err) {
      logger.error('BOOSTER', `Failed to set icon: ${err.message}`);
      const card = notification('error', `❌ Failed to set role icon. Requires Boost Level 2+.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
    }
  },

  async handleDelete(message, client) {
    const db = getDb();
    const claimed = BoosterRepo.get(db, message.author.id);
    if (!claimed) {
      const card = notification('error', `❌ You do not have a custom booster role.`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    const role = message.guild.roles.cache.get(claimed.role_id);
    if (role) {
      await role.delete(`Custom role deleted by booster claim owner.`).catch(() => null);
    }

    BoosterRepo.delete(db, message.author.id);

    const card = notification('success', `✅ Your custom booster role has been deleted.`, client);
    await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
  },

  async handleList(message, args, client) {
    const db = getDb();
    const allRoles = BoosterRepo.listAll(db);

    // Clean up invalid records
    const valid = [];
    for (const record of allRoles) {
      const role = message.guild.roles.cache.get(record.role_id);
      if (role) {
        valid.push(record);
      } else {
        BoosterRepo.delete(db, record.user_id);
      }
    }

    if (valid.length === 0) {
      const card = notification('info', `*No claimed custom booster roles.*`, client);
      await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
      return;
    }

    const page = parseInt(args[0], 10) || 1;
    const totalPages = Math.ceil(valid.length / CMDS_PER_PAGE);
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * CMDS_PER_PAGE;
    const pageRoles = valid.slice(start, start + CMDS_PER_PAGE);

    const lines = [`### 🚀 Claimed Booster Roles`];
    pageRoles.forEach((r, i) => {
      lines.push(`${start + i + 1}. <@${r.user_id}> — <@&${r.role_id}>`);
    });

    const container = createV2Container({
      description: lines.join('\n'),
      color: config.colors.primary,
      thumbnail: assets.voice,
      client,
    });

    const ext = totalPages > 1 ? [paginationRow('bb_list', safePage, totalPages, message.author.id)] : [];
    await message.reply({
      ...v2Payload(container, ext),
      allowedMentions: { repliedUser: false },
    });
  },
};