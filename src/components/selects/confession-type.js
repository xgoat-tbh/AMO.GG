import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';

export default {
  customId: 'confession:type',

  async execute(interaction) {
    const type = interaction.values?.[0];

    const isKnown = type === 'known';
    const modal = new ModalBuilder()
      .setCustomId(`confession:submit:${isKnown ? 'known' : 'anonymous'}`)
      .setTitle(isKnown ? 'Known Confession' : 'Anonymous Confession');

    const contentInput = new TextInputBuilder()
      .setCustomId('confession-content')
      .setLabel('Your confession')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(2000)
      .setRequired(true)
      .setPlaceholder(isKnown
        ? 'Write your confession here...'
        : 'Write your confession here... Your identity will be hidden.');

    const row = new ActionRowBuilder().addComponents(contentInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  },
};
