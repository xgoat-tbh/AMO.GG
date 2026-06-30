import { createV2Container, v2Payload, notification } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { checkPermission } from '../../helpers/permissions.js';
import { getDb } from '../../database/connection.js';
import { ConfigRepo } from '../../database/repositories/config.repo.js';

export default {
  name: 'setprefix',
  aliases: ['prefix'],
  description: 'Change the bot command prefix.',
  usage: '?setprefix <new_prefix>',
  permission: 'admin',

  async execute(message, args, client) {
    try {
      if (!args.length) return sendUsageError(message, '?setprefix <new_prefix>');

      const newPrefix = args[0];
      if (newPrefix.length > 5) {
        const card = notification('error', '\u274C Prefix must be 5 characters or less.', client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        setTimeout(async () => { try { await message.delete(); } catch {}; try { await reply.delete(); } catch {}; }, 5000);
        return;
      }

      const oldPrefix = config.prefix;

      const db = getDb();
      ConfigRepo.set(db, 'prefix', newPrefix);
      config.prefix = newPrefix;

      const lines = [
        `### \u2705 Prefix Changed`,
        `**Old:** \`${oldPrefix}\``,
        `**New:** \`${newPrefix}\``,
        '',
        `Use \`${newPrefix}help\` to see all commands.`,
      ];

      const container = createV2Container({
        description: lines.join('\n'),
        client,
      });

      const reply = await message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      try { await message.delete(); } catch {}
      setTimeout(async () => { try { await reply.delete(); } catch {}; }, 8000);
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
