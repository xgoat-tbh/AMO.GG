import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
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

    const select = new StringSelectMenuBuilder()
      .setCustomId('confession:type')
      .setPlaceholder('Select confession type...')
      .addOptions([
        { label: 'Known', value: 'known', emoji: emojis.confession, description: 'Your name will be shown with the confession' },
        { label: 'Anonymous', value: 'anonymous', emoji: '🕶', description: 'Your identity will be kept private' },
      ]);

    await message.author.send(v2Payload(container, [new ActionRowBuilder().addComponents(select)])).catch(() => {});
  },
};