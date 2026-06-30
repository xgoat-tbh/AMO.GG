import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelSelectMenuBuilder, MessageFlags, ChannelType } from 'discord.js';
import { getDraft, saveDraft, buildBuilderPayload, parseHexColor } from '../../systems/embeds/embedBuilderManager.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'embed:edit',

  async execute(interaction, client) {
    const field = interaction.values?.[0];

    if (!field) {
      await interaction.reply({ content: `${emojis.error} Invalid field.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const draft = getDraft(interaction.user.id);

    if (field === 'channel') {
      const select = new ChannelSelectMenuBuilder()
        .setCustomId('embed:edit:channel')
        .setPlaceholder('Select target channel')
        .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

      await interaction.reply({
        content: 'Choose a channel to publish the embed:',
        components: [new ActionRowBuilder().addComponents(select)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modalFields = {
      title: {
        title: 'Edit Title',
        label: 'Embed Title',
        value: draft.title,
        placeholder: 'Enter a title for your embed',
        maxLength: 256,
      },
      description: {
        title: 'Edit Description',
        label: 'Embed Description',
        value: draft.description,
        placeholder: 'Enter the description text',
        style: TextInputStyle.Paragraph,
        maxLength: 4000,
      },
      color: {
        title: 'Edit Color',
        label: 'Hex Color',
        value: draft.color,
        placeholder: '#5865F2',
        maxLength: 7,
      },
      thumbnail: {
        title: 'Edit Thumbnail',
        label: 'Thumbnail URL',
        value: draft.thumbnail || '',
        placeholder: 'https://example.com/image.png',
        maxLength: 1024,
      },
    };

    const meta = modalFields[field];
    if (!meta) {
      await interaction.reply({ content: `${emojis.error} Unknown field.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`embed:modal:${field}`)
      .setTitle(meta.title);

    const input = new TextInputBuilder()
      .setCustomId(`embed_${field}`)
      .setLabel(meta.label)
      .setValue(meta.value || '')
      .setStyle(meta.style || TextInputStyle.Short)
      .setMaxLength(meta.maxLength || 4000)
      .setRequired(true);

    if (meta.placeholder) input.setPlaceholder(meta.placeholder);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  },
};
