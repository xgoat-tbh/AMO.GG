import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';
import { createV2Container, v2Payload } from '../../helpers/v2Helper.js';

export default {
  name: 'confess',
  aliases: ['confession', 'c'],
  description: 'Submit a confession.',
  usage: '?confess',
  permission: 'everyone',

  async execute(message, args, client) {
    try { await message.delete(); } catch {}

    const container = createV2Container({
      title: '📝 Confession',
      description: 'Choose how to submit your confession:',
      fields: [
        { name: '📝 Known', value: 'Your name will be shown with the confession' },
        { name: '🕶 Anonymous', value: 'Your identity will be kept private' },
      ],
      color: config.colors.confession,
      client,
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confession:known')
        .setLabel('Known')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(emojis.confession),
      new ButtonBuilder()
        .setCustomId('confession:anonymous')
        .setLabel('Anonymous')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🕶'),
    );

    await message.author.send(v2Payload(container, [row])).catch(() => {});
  },
};