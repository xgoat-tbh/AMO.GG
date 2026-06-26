import { getDb } from '../../database/connection.js';
import { getSnipe, canSnipe, getMaxLimit, setMaxLimit } from '../../systems/snipe/snipeManager.js';
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
  usage: '?snipe [index] | ?snipe limit [1-20] | ?snipe permit <add | remove | list | clear> [user | role] [target]',
  permission: 'everyone', // Permission is checked dynamically in execute()

  async execute(message, args, client) {
    try {
      // 1. Check if permission setup or limit subcommand is run
      if (args[0] === 'permit') {
        return await this.handlePermit(message, args.slice(1), client);
      }

      if (args[0] === 'limit') {
        return await this.handleLimit(message, args.slice(1), client);
      }

      // 2. Regular snipe execution
      // Check custom/staff permission
      if (!canSnipe(message.member)) {
        const container = createV2Error(`${emojis.error} You do not have permission to use the snipe command.`, client);
        await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        return;
      }

      const maxLimit = getMaxLimit();
      let index = 1;
      if (args.length) {
        index = parseInt(args[0], 10);
        if (isNaN(index) || index < 1 || index > maxLimit) {
          const container = createV2Error(`${emojis.error} Snipe index must be a number between 1 and ${maxLimit}.`, client);
          await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
          return;
        }
      }

      const snipeData = getSnipe(message.channel.id, index);
      if (!snipeData) {
        const container = createV2Error(`${emojis.error} No deleted messages found at index **${index}** in this channel.`, client);
        await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        return;
      }

      const { message: deletedMsg, totalCount } = snipeData;

      const lines = [
        `### 🎯 Snipe #${index} of ${totalCount}`,
        `**Author**: <@${deletedMsg.author.id}> (${deletedMsg.author.tag})`,
        `**Deleted**: <t:${deletedMsg.timestamp}:R>`,
        `\n**Content**: ${deletedMsg.content || '*No text content*'}`
      ];

      if (deletedMsg.attachments.length > 0) {
        lines.push(
          `\n🖼️ **Attachments**:`,
          ...deletedMsg.attachments.map((url, idx) => `• [Attachment ${idx + 1}](${url})`)
        );
      }

      const container = createV2Container({
        description: lines.join('\n'),
        color: config.colors.primary,
        thumbnail: deletedMsg.author.avatar,
        client,
      });

      await message.reply({
        ...v2Payload(container),
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
        const container = createV2Error(`${emojis.error} Only Administrators can configure the snipe limit.`, client);
        await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
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
        const container = createV2Error(`${emojis.error} Snipe limit must be a number between 1 and 20.`, client);
        await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        return;
      }

      setMaxLimit(newLimit);
      const container = createV2Success(`${emojis.success} Successfully updated the snipe limit to **${newLimit}** messages.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },

  async handlePermit(message, args, client) {
    // Admin only for configuration
    const isAdmin = checkPermission(message.member, 'admin');
    if (!isAdmin) {
      const container = createV2Error(`${emojis.error} Only Administrators can configure snipe permissions.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    if (!args.length) {
      return sendUsageError(message, '?snipe permit <add | remove | list | clear> [user | role] [target]');
    }

    const action = args[0].toLowerCase();
    const db = getDb();

    if (action === 'clear') {
      db.prepare("DELETE FROM bot_config WHERE key IN ('snipe_allowed_users', 'snipe_allowed_roles')").run();
      const container = createV2Success(`${emojis.success} Successfully cleared all custom snipe permissions. Default staff permissions restored.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
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
      const container = createV2Error(`${emojis.error} Target type must be either \`user\` or \`role\`.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      return;
    }

    const configKey = type === 'user' ? 'snipe_allowed_users' : 'snipe_allowed_roles';
    const row = db.prepare("SELECT value FROM bot_config WHERE key = ?").get(configKey);
    let ids = row && row.value ? row.value.split(',').filter(Boolean) : [];

    if (action === 'add') {
      if (type === 'user') {
        const user = await client.users.fetch(targetId).catch(() => null);
        if (!user) {
          const container = createV2Error(`${emojis.error} Invalid user ID or mention.`, client);
          await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
          return;
        }
      } else {
        const role = message.guild.roles.cache.get(targetId);
        if (!role) {
          const container = createV2Error(`${emojis.error} Invalid role ID or mention.`, client);
          await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
          return;
        }
      }

      if (ids.includes(targetId)) {
        const container = createV2Error(`${emojis.error} That target already has custom snipe permissions.`, client);
        await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
        return;
      }

      ids.push(targetId);
      db.prepare("INSERT OR REPLACE INTO bot_config (key, value) VALUES (?, ?)")
        .run(configKey, ids.join(','));

      const mention = type === 'user' ? `<@${targetId}>` : `<@&${targetId}>`;
      const container = createV2Success(`${emojis.success} Successfully granted custom snipe permissions to ${mention}.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });

    } else if (action === 'remove') {
      if (!ids.includes(targetId)) {
        const container = createV2Error(`${emojis.error} That target does not have custom snipe permissions.`, client);
        await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
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
      const container = createV2Success(`${emojis.success} Successfully removed custom snipe permissions from ${mention}.`, client);
      await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
    }
  },
};
