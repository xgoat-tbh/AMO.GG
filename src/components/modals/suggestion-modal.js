import { MessageFlags } from 'discord.js';
import { create } from '../../systems/suggestions/suggestionManager.js';
import { botConfig as config } from '../../helpers/configHelper.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'suggestion:submit',

  async execute(interaction, client) {
    // Get suggestion content from the modal fields
    const content = interaction.fields.getTextInputValue('suggestion-content');

    if (!content || !content.trim()) {
      await interaction.reply({ content: `${emojis.error} Suggestion content cannot be empty.`, flags: MessageFlags.Ephemeral });
      return;
    }

    // Defer to avoid timeout while we send the suggestion
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Get the suggestion channel
    const channelId = config.channels.suggestion;
    if (!channelId) {
      await interaction.editReply({ content: `${emojis.error} Suggestion channel is not configured.` });
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      await interaction.editReply({ content: `${emojis.error} Could not find the suggestion channel.` });
      return;
    }

    // Create and send the suggestion
    const author = interaction.user;
    await create(author, content.trim(), channel);

    await interaction.editReply({
      content: `${emojis.success} Your suggestion has been posted!`,
    });
  },
};
