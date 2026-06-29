import { notification, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';
import { sanitizeContent } from '../../helpers/sanitizer.js';

export default {
  name: 'suggest',
  aliases: ['suggestion', 'idea'],
  description: 'Submit a suggestion.',
  usage: '?suggest <your suggestion>',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      if (!args.length) {
        return sendUsageError(message, this.usage);
      }

      const { botConfig: config } = await import('../../helpers/configHelper.js');
      const channelId = config.channels.suggestion;

      if (!channelId) {
        const card = notification('error', `${emojis.error} Suggestion channel is not configured.`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        try { await message.delete(); } catch {}
        setTimeout(async () => { try { await reply.delete(); } catch {} }, 6000);
        return;
      }

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        const card = notification('error', `${emojis.error} Could not find the suggestion channel.`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        try { await message.delete(); } catch {}
        setTimeout(async () => { try { await reply.delete(); } catch {} }, 6000);
        return;
      }

      const { sanitized, valid, reason } = sanitizeContent(args.join(' '), 2000, 'Suggestion');
      if (!valid) {
        const card = notification('error', `${emojis.error} ${reason}`, client);
        const reply = await message.reply({ ...v2Payload(card), allowedMentions: { repliedUser: false } });
        try { await message.delete(); } catch {}
        setTimeout(async () => { try { await reply.delete(); } catch {} }, 6000);
        return;
      }

      const { create } = await import('../../systems/suggestions/suggestionManager.js');
      await create(message.author, sanitized, channel);

      const reply = await message.reply({
        ...v2Payload(notification('success', `${emojis.success} Your suggestion has been posted!`, client)),
        allowedMentions: { repliedUser: false },
      });

      try { await message.delete(); } catch {}
      setTimeout(async () => { try { await reply.delete(); } catch {} }, 6000);

    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};