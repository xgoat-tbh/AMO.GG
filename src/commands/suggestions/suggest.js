import { createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError, sendUsageError } from '../../helpers/errorHandler.js';

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
        const reply = await message.reply({
          ...v2Payload(createV2Error(`${emojis.error} Suggestion channel is not configured.`, client)),
          allowedMentions: { repliedUser: false },
        });
        try { await message.delete(); } catch {}
        setTimeout(async () => {
          try { await reply.delete(); } catch {}
        }, 6000);
        return;
      }

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        const reply = await message.reply({
          ...v2Payload(createV2Error(`${emojis.error} Could not find the suggestion channel.`, client)),
          allowedMentions: { repliedUser: false },
        });
        try { await message.delete(); } catch {}
        setTimeout(async () => {
          try { await reply.delete(); } catch {}
        }, 6000);
        return;
      }

      const content = args.join(' ');
      if (content.length > 2000) {
        const reply = await message.reply({
          ...v2Payload(createV2Error(`${emojis.error} Suggestion must be under 2000 characters.`, client)),
          allowedMentions: { repliedUser: false },
        });
        try { await message.delete(); } catch {}
        setTimeout(async () => {
          try { await reply.delete(); } catch {}
        }, 6000);
        return;
      }

      // Dynamically import the create function from suggestionManager
      const { create } = await import('../../systems/suggestions/suggestionManager.js');
      await create(message.author, content, channel);

      const reply = await message.reply({
        ...v2Payload(createV2Success(`${emojis.success} Your suggestion has been posted!`, client)),
        allowedMentions: { repliedUser: false },
      });

      try { await message.delete(); } catch {}

      setTimeout(async () => {
        try { await reply.delete(); } catch {}
      }, 6000);

    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
