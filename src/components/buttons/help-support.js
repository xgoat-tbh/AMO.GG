import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'help:support',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the help command can use this.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`help:support:modal:${executorId}`)
      .setTitle('Support Query');

    const queryInput = new TextInputBuilder()
      .setCustomId('support-query')
      .setLabel('What do you need help with?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Describe your issue or question...')
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(queryInput));

    await interaction.showModal(modal);
  },
};