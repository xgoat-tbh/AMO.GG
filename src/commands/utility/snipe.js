import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { getChannelSnipes, getMaxLimit, setMaxLimit } from '../../systems/snipe/snipeManager.js';
import { createV2Container, createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { checkPermission } from '../../helpers/permissions.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { assets } from '../../config/assets.config.js';

export default {
  name: 'snipe',
  aliases: ['s'],
  description: 'Recover recently deleted messages in the channel.',
  usage: '?snipe | ?snipe limit [1-20] | ?snipe permit <add | remove | list | clear> [user | role] [target]',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      if (args[0] === 'permit') {
        return await this.handlePermit(message, args.slice(1), client);
      }

      if (args[0] === 'limit') {
        return await this.handleLimit(message, args.slice(1), client);
      }

      const snipes = getChannelSnipes(message.channel.id);
      if (!snipes.length) {
        const container = createV2Error(`${emojis.error} No deleted messages found in this channel.`, client);
        const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      const authorMap = new Map();
      for (const msg of snipes) {
        const id = msg.author.id;
        if (!authorMap.has(id)) {
          authorMap.set(id, { ...msg.author, count: 0 });
        }
        authorMap.get(id).count++;
      }

      const users = [...authorMap.values()];

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`snipe:user:${message.author.id}`)
        .setPlaceholder('Select a user to view their deleted messages...');

      for (const user of users) {
        const label = `${user.displayName} (${user.count})`.slice(0, 100);
        menu.addOptions({
          label,
          value: user.id,
        });
      }

      const row = new ActionRowBuilder().addComponents(menu);

      const container = createV2Container({
        description: `### 🎯 Snipe — User Selection\nSelect a user to view their deleted messages from this channel.`,
        color: config.colors.primary,
        client,
      });

      await message.reply({
        ...v2Payload(container, [row]),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async handleLimit(message, args, client) {
    try {
      // Admin only for configuration
      const isAdmin = checkPermission(message.member, 'admin');
      if (!isAdmin) {
        const container = createV2Error('❌ Only Administrators can configure the snipe limit.', client);
        const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      if (!args.length) {
        const currentLimit = getMaxLimit();
        const container = createV2Container({
          description: `### 🎯 Snipe Limit\nThe current snipe limit is set to **${currentLimit}** messages.\n\n*Use \`?snipe limit <1-20>\` to change this value.*`,
          color: config.colors.primary,
          client,
        });
        await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        return;
      }

      const newLimit = parseInt(args[0], 10);
      if (isNaN(newLimit) || newLimit < 1 || newLimit > 20) {
        const container = createV2Error('❌ Snipe limit must be a number between 1 and 20.', client);
        const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      setMaxLimit(newLimit);
      const container = createV2Success(`✅ Successfully updated the snipe limit to **${newLimit}** messages.`, client);
      const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async handlePermit(message, args, client) {
    // Admin only for configuration
    const isAdmin = checkPermission(message.member, 'admin');
    if (!isAdmin) {
      const container = createV2Error('❌ Only Administrators can configure snipe permissions.', client);
      const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
      return;
    }

    if (!args.length) {
      return sendUsageError(message, '?snipe permit <add | remove | list | clear> [user | role] [target]');
    }

    const action = args[0].toLowerCase();
    const db = getDb();

    if (action === 'clear') {
      db.prepare("DELETE FROM bot_config WHERE key IN ('snipe_allowed_users', 'snipe_allowed_roles')").run();
      const container = createV2Success('✅ Successfully cleared all custom snipe permissions. Default staff permissions restored.', client);
      const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
      return;
    }

    if (action === 'list') {
      const userRow = db.prepare("SELECT value FROM bot_config WHERE key = 'snipe_allowed_users'").get();
      const roleRow = db.prepare("SELECT value FROM bot_config WHERE key = 'snipe_allowed_roles'").get();

      const userIds = userRow && userRow.value ? userRow.value.split(',').filter(Boolean) : [];
      const roleIds = roleRow && roleRow.value ? roleRow.value.split(',').filter(Boolean) : [];

      const lines = [
        `### 🎯 Snipe Custom Permissions`,
        `**Allowed Users**: ${userIds.map(id => `<@${id}>`).join(', ') || '*None*'}`,
        `**Allowed Roles**: ${roleIds.map(id => `<@&${id}>`).join(', ') || '*None*'}`,
        `\n*Staff members (Moderators and Admins) always have permission.*`
      ];

      const container = createV2Container({
        description: lines.join('\n'),
        color: config.colors.primary,
        thumbnail: assets.moderation,
        client,
      });

      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    if (args.length < 3) {
      return sendUsageError(message, '?snipe permit <add | remove> <user | role> <target>');
    }

    const type = args[1].toLowerCase();
    const targetQuery = args[2];
    const targetId = targetQuery.replace(/[<@&!>]/g, '');

    if (type !== 'user' && type !== 'role') {
      const container = createV2Error('❌ Target type must be either `user` or `role`.', client);
      const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
      return;
    }

    const configKey = type === 'user' ? 'snipe_allowed_users' : 'snipe_allowed_roles';
    const row = db.prepare("SELECT value FROM bot_config WHERE key = ?").get(configKey);
    let ids = row && row.value ? row.value.split(',').filter(Boolean) : [];

    if (action === 'add') {
      if (type === 'user') {
        const user = await client.users.fetch(targetId).catch(() => null);
        if (!user) {
          const container = createV2Error('❌ Invalid user ID or mention.', client);
          const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
          setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
          return;
        }
      } else {
        const role = message.guild.roles.cache.get(targetId);
        if (!role) {
          const container = createV2Error('❌ Invalid role ID or mention.', client);
          const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
          setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
          return;
        }
      }

      if (ids.includes(targetId)) {
        const container = createV2Error('❌ That target already has custom snipe permissions.', client);
        const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      ids.push(targetId);
      db.prepare("INSERT OR REPLACE INTO bot_config (key, value) VALUES (?, ?)")
        .run(configKey, ids.join(','));

      const mention = type === 'user' ? `<@${targetId}>` : `<@&${targetId}>`;
      const container = createV2Success(`✅ Successfully granted custom snipe permissions to ${mention}.`, client);
      const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);

    } else if (action === 'remove') {
      if (!ids.includes(targetId)) {
        const container = createV2Error('❌ That target does not have custom snipe permissions.', client);
        const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      ids = ids.filter(id => id !== targetId);
      if (ids.length > 0) {
        db.prepare("INSERT OR REPLACE INTO bot_config (key, value) VALUES (?, ?)")
          .run(configKey, ids.join(','));
      } else {
        db.prepare("DELETE FROM bot_config WHERE key = ?").run(configKey);
      }

      const mention = type === 'user' ? `<@${targetId}>` : `<@&${targetId}>`;
      const container = createV2Success(`✅ Successfully removed custom snipe permissions from ${mention}.`, client);
      const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
    }
  },
};
