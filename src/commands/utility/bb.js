import { getDb } from '../../database/connection.js';
import { BoosterRepo } from '../../database/repositories/booster.repo.js';
import { createV2Container, createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { checkPermission } from '../../helpers/permissions.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { assets } from '../../config/assets.config.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

export default {
  name: 'bb',
  aliases: ['booster', 'boost', 'rolelist'],
  description: 'Manage personal custom booster roles.',
  usage: '?bb <claim | color | name | icon | delete | list | setup> [args]',
  permission: 'everyone', // Everyone can run, but subcommands check booster status

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
          return await this.handleList(message, client);
        default:
          return this.sendHelp(message, client);
      }
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async sendHelp(message, client) {
    const lines = [
      `### 🚀 Custom Booster Role Commands`,
      `• \`?bb claim\` — Claims your personal custom booster role.`,
      `• \`?bb color <hex_color>\` — Changes the color of your claimed role (e.g. #FF0000).`,
      `• \`?bb name <new_name>\` — Changes the name of your custom role.`,
      `• \`?bb icon <emoji | image_url>\` — Sets a custom icon for your role (Boost Level 2 required).`,
      `• \`?bb delete\` — Deletes your custom role.`,
      `• \`?bb list\` — Lists all claimed booster roles in the server.`,
      `\n*Administrators can configure the base role using:*`,
      `• \`?bb setup <@role | role_id>\` — Establishes the base role above which custom roles are created.`,
    ];

    const container = createV2Container({
      description: lines.join('\n'),
      color: config.colors.primary,
      thumbnail: assets.voice, // headset icon fits booster/perks
      client,
    });

    await message.reply({
      ...v2Payload(container),
      allowedMentions: { repliedUser: false },
    });
  },

  async handleSetup(message, args, client) {
    // Admin only
    const isAdmin = checkPermission(message.member, 'admin');
    if (!isAdmin) {
      const container = createV2Error(`${emojis.error} Only Administrators can configure the booster system.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    if (!args.length) {
      return sendUsageError(message, '?bb setup <@role | role_id>');
    }

    // Resolve role
    const query = args[0];
    const roleId = query.replace(/[<@&>]/g, '');
    const role = message.guild.roles.cache.get(roleId);

    if (!role) {
      const container = createV2Error(`${emojis.error} Role not found. Please mention a valid role or provide its ID.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    const db = getDb();
    db.prepare(
      "INSERT OR REPLACE INTO bot_config (key, value) VALUES ('booster_base_role', ?)"
    ).run(role.id);

    const container = createV2Success(`${emojis.success} **Booster base role established to <@&${role.id}>.** New custom booster roles will be created just above this role in the hierarchy.`, client);
    await message.reply({
      ...v2Payload(container),
      allowedMentions: { repliedUser: false },
    });
  },

  async handleClaim(message, client) {
    const db = getDb();

    // Check if booster base role is set
    const baseRoleRow = db.prepare("SELECT value FROM bot_config WHERE key = 'booster_base_role'").get();
    if (!baseRoleRow || !baseRoleRow.value) {
      const container = createV2Error(`${emojis.error} The booster base role has not been set by an Administrator yet. Please use \`?bb setup <role>\` first.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    const baseRole = message.guild.roles.cache.get(baseRoleRow.value);
    if (!baseRole) {
      const container = createV2Error(`${emojis.error} Configured base role no longer exists in the server. Please contact an Administrator to re-run setup.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    // Check booster status (nitro boost or admin override)
    const nativeBoosterRole = message.guild.roles.cache.find(r => r.tags && r.tags.premiumSubscriberRole);
    const isPremium = message.member.premiumSince !== null || 
                      (nativeBoosterRole && message.member.roles.cache.has(nativeBoosterRole.id));
    const isAdmin = checkPermission(message.member, 'admin');

    if (!isPremium && !isAdmin) {
      const container = createV2Error(`${emojis.error} Only server boosters (Nitro Boosters) can claim custom roles.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    // Check if already claimed
    let claimed = BoosterRepo.get(db, message.author.id);
    if (claimed) {
      const existingRole = message.guild.roles.cache.get(claimed.role_id);
      if (existingRole) {
        const container = createV2Error(`${emojis.error} You already have a claimed booster role: <@&${existingRole.id}>.`, client);
        await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        return;
      } else {
        // Clean up deleted role record
        BoosterRepo.delete(db, message.author.id);
      }
    }

    // Create role
    try {
      const defaultName = `${message.member.displayName || message.author.username}'s Role`;
      const newRole = await message.guild.roles.create({
        name: defaultName,
        color: '#FFFFFF',
        reason: `Custom booster role claimed by ${message.author.tag}`,
      });

      // Move role position above base role
      await newRole.setPosition(baseRole.position + 1).catch(err => {
        logger.warn('BOOSTER', `Failed to adjust role position above base: ${err.message}`);
      });

      // Assign role to member
      await message.member.roles.add(newRole);

      // Save to database
      BoosterRepo.create(db, message.author.id, newRole.id);

      const container = createV2Success(`${emojis.success} **Personal booster role claimed successfully!**\n• Role: <@&${newRole.id}>\n• Use \`?bb color <hex_color>\` and \`?bb name <new_name>\` to configure.`, client);
      await message.reply({
        ...v2Payload(container),
        allowedMentions: { repliedUser: false },
      });
    } catch (err) {
      logger.error('BOOSTER', `Error creating custom role: ${err.message}`, err);
      const container = createV2Error(`${emojis.error} Failed to create role. Ensure the bot has "Manage Roles" permission and its highest role is placed above the booster base role.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
    }
  },

  async handleColor(message, args, client) {
    if (!args.length) {
      return sendUsageError(message, '?bb color <hex_color>');
    }

    const hex = args[0].trim();
    const hexRegex = /^#?[0-9a-fA-F]{6}$/;
    if (!hexRegex.test(hex)) {
      const container = createV2Error(`${emojis.error} Invalid hex color format. Use e.g. \`#FF0000\` or \`5865F2\`.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    const db = getDb();
    const claimed = BoosterRepo.get(db, message.author.id);
    if (!claimed) {
      const container = createV2Error(`${emojis.error} You do not have a custom booster role. Use \`?bb claim\` first.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    const role = message.guild.roles.cache.get(claimed.role_id);
    if (!role) {
      BoosterRepo.delete(db, message.author.id);
      const container = createV2Error(`${emojis.error} Your claimed role was deleted. Use \`?bb claim\` to create a new one.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    try {
      await role.setColor(hex);
      const container = createV2Success(`${emojis.success} Changed your role color to \`${hex}\`.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
    } catch (err) {
      const container = createV2Error(`${emojis.error} Failed to change color: ${err.message}`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
    }
  },

  async handleName(message, args, client) {
    if (!args.length) {
      return sendUsageError(message, '?bb name <new_name>');
    }

    const name = args.join(' ').trim();
    if (name.length < 1 || name.length > 32) {
      const container = createV2Error(`${emojis.error} Role name must be between 1 and 32 characters.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    const db = getDb();
    const claimed = BoosterRepo.get(db, message.author.id);
    if (!claimed) {
      const container = createV2Error(`${emojis.error} You do not have a custom booster role. Use \`?bb claim\` first.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    const role = message.guild.roles.cache.get(claimed.role_id);
    if (!role) {
      BoosterRepo.delete(db, message.author.id);
      const container = createV2Error(`${emojis.error} Your claimed role was deleted. Use \`?bb claim\` to create a new one.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    try {
      await role.setName(name);
      const container = createV2Success(`${emojis.success} Changed your role name to **"${name}"**.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
    } catch (err) {
      const container = createV2Error(`${emojis.error} Failed to change name: ${err.message}`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
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
      const container = createV2Error(`${emojis.error} You do not have a custom booster role. Use \`?bb claim\` first.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    const role = message.guild.roles.cache.get(claimed.role_id);
    if (!role) {
      BoosterRepo.delete(db, message.author.id);
      const container = createV2Error(`${emojis.error} Your claimed role was deleted. Use \`?bb claim\` to create a new one.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    try {
      if (iconInput.startsWith('http://') || iconInput.startsWith('https://')) {
        await role.setIcon(iconInput);
      } else {
        await role.setUnicodeEmoji(iconInput);
      }

      const container = createV2Success(`${emojis.success} Successfully updated your custom role icon.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
    } catch (err) {
      logger.error('BOOSTER', `Failed to set icon: ${err.message}`);
      const container = createV2Error(`${emojis.error} Failed to set role icon. *Note: Setting custom role icons requires the server to be Boost Level 2.*`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
    }
  },

  async handleDelete(message, client) {
    const db = getDb();
    const claimed = BoosterRepo.get(db, message.author.id);
    if (!claimed) {
      const container = createV2Error(`${emojis.error} You do not have a custom booster role.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    const role = message.guild.roles.cache.get(claimed.role_id);
    if (role) {
      await role.delete(`Custom role deleted by booster claim owner.`).catch(() => null);
    }

    BoosterRepo.delete(db, message.author.id);

    const container = createV2Success(`${emojis.success} Your custom booster role has been deleted.`, client);
    await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
  },

  async handleList(message, client) {
    const db = getDb();
    const allRoles = BoosterRepo.listAll(db);

    const lines = [
      `### 🚀 Claimed Booster Roles`,
    ];

    let count = 0;
    for (const record of allRoles) {
      const role = message.guild.roles.cache.get(record.role_id);
      if (role) {
        count++;
        lines.push(`${count}. <@${record.user_id}> — <@&${role.id}>`);
      } else {
        // Clean up from DB if role doesn't exist
        BoosterRepo.delete(db, record.user_id);
      }
    }

    if (count === 0) {
      lines.push(`*No claimed custom booster roles at the moment.*`);
    }

    const container = createV2Container({
      description: lines.join('\n'),
      color: config.colors.primary,
      thumbnail: assets.voice,
      client,
    });

    await message.reply({
      ...v2Payload(container),
      allowedMentions: { repliedUser: false },
    });
  },
};
