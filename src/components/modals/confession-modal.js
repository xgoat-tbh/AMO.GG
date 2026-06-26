import { MessageFlags } from 'discord.js';
import { create } from '../../systems/confessions/confessionManager.js';
import { botConfig as config } from '../../helpers/configHelper.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'confession:submit',

  async execute(interaction, client) {
    // Parse type from customId: 'confession:submit:known' or 'confession:submit:anonymous'
    const parts = interaction.customId.split(':');
    const type = parts[2]; // 'known' or 'anonymous'

    if (!type || !['known', 'anonymous'].includes(type)) {
      await interaction.reply({ content: `${emojis.error} Invalid confession type.`, flags: MessageFlags.Ephemeral });
      return;
    }

    // Get confession content from the modal fields
    const content = interaction.fields.getTextInputValue('confession-content');

    if (!content || !content.trim()) {
      await interaction.reply({ content: `${emojis.error} Confession content cannot be empty.`, flags: MessageFlags.Ephemeral });
      return;
    }

    // Defer to avoid timeout while we send the confession
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Get the confession channel
    const channelId = config.channels.confession;
    if (!channelId) {
      await interaction.editReply({ content: `${emojis.error} Confession channel is not configured.` });
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      await interaction.editReply({ content: `${emojis.error} Could not find the confession channel.` });
      return;
    }

    // Create and send the confession
    const author = interaction.user;
    await create(author, content.trim(), type, channel, client);

    await interaction.editReply({
      content: `${emojis.success} Your ${type === 'anonymous' ? 'anonymous ' : ''}confession has been posted!`,
    });
  },
};
