import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'help:report',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the help command can use this button.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId('help:report_modal')
      .setTitle('⚠️ Report a Problem');

    const descInput = new TextInputBuilder()
      .setCustomId('problem_desc')
      .setLabel('Describe your problem')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Provide details about the issue you are facing...')
      .setMinLength(10)
      .setMaxLength(1000)
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(descInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
  },
};
