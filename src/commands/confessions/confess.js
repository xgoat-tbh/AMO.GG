import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';
import { createV2Container, v2Payload } from '../../helpers/v2Helper.js';

export default {
  name: 'confess',
  aliases: ['confession', 'c'],
  description: 'Submit a confession.',
  usage: '?confess',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      const container = createV2Container({
        description: `${emojis.confession} Choose how to submit your confession:`,
        color: config.colors.confession,
        client,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confession:known')
          .setLabel('📝 Known')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('confession:anonymous')
          .setLabel('🕶 Anonymous')
          .setStyle(ButtonStyle.Secondary),
      );

      // Attempt to send DM
      try {
        await message.author.send(v2Payload(container, [row]));

        // If in a guild, clean up the channel
        if (message.guild) {
          const confirmation = await message.reply({
            content: `${emojis.success} Check your DMs to submit your confession!`,
            allowedMentions: { repliedUser: false },
          });

          // Delete the user's message and confirmation message after 5 seconds
          setTimeout(async () => {
            try {
              await message.delete();
            } catch {}
            try {
              await confirmation.delete();
            } catch {}
          }, 5000);
        }
      } catch (dmError) {
        // DM failed
        const errorReply = await message.reply({
          content: `${emojis.error} I couldn't send you a DM. Please enable DMs from server members in your privacy settings.`,
          allowedMentions: { repliedUser: false },
        });

        // Delete the error reply after 10 seconds
        setTimeout(async () => {
          try {
            await errorReply.delete();
          } catch {}
        }, 10000);
      }
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
