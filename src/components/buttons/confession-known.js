import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'confession:known',

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('confession:submit:known')
      .setTitle(`${emojis.confession} Known Confession`);

    const contentInput = new TextInputBuilder()
      .setCustomId('confession-content')
      .setLabel('Your confession')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(2000)
      .setRequired(true)
      .setPlaceholder('Write your confession here...');

    const row = new ActionRowBuilder().addComponents(contentInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  },
};
