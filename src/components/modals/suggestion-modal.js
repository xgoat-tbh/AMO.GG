import { MessageFlags } from 'discord.js';
import { create } from '../../systems/suggestions/suggestionManager.js';
import { botConfig as config } from '../../helpers/configHelper.js';
import { emojis } from '../../config/emojis.config.js';
import { sanitizeContent } from '../../helpers/sanitizer.js';

export default {
  customId: 'suggestion:submit',

  async execute(interaction, client) {
    const content = interaction.fields.getTextInputValue('suggestion-content');

    // Validate and sanitize
    const { sanitized, valid, reason } = sanitizeContent(content, 2000, 'Suggestion');
    if (!valid) {
      await interaction.reply({ content: `${emojis.error} ${reason}`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

    const author = interaction.user;
    await create(author, sanitized, channel);

    await interaction.editReply({
      content: `${emojis.success} Your suggestion has been posted!`,
    });
  },
};
