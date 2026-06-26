import { MessageFlags } from 'discord.js';
import { isModerator } from '../../helpers/permissions.js';
import { emojis } from '../../config/emojis.config.js';
import { complete } from '../../systems/suggestions/suggestionManager.js';

export default {
  customId: 'suggestion:complete',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const suggestionId = parseInt(parts[2]);

    if (isNaN(suggestionId)) {
      await interaction.reply({ content: `${emojis.error} Invalid suggestion ID.`, flags: MessageFlags.Ephemeral });
      return;
    }

    // Check if the user is a moderator
    if (!isModerator(interaction.member)) {
      await interaction.reply({
        content: `${emojis.error} Only moderators can mark suggestions as completed.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await complete(suggestionId, interaction.member, interaction);
  },
};
