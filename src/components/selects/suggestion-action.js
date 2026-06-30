import { MessageFlags } from 'discord.js';
import { handleVote } from '../../systems/suggestions/suggestionManager.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'suggestion:action',

  async execute(interaction) {
    const parts = interaction.customId.split(':');
    const suggestionId = parseInt(parts[2], 10);
    const voteType = interaction.values?.[0];

    if (!voteType || !['yes', 'no'].includes(voteType) || isNaN(suggestionId)) {
      await interaction.reply({ content: `${emojis.error} Invalid vote data.`, flags: MessageFlags.Ephemeral });
      return;
    }

    await handleVote(suggestionId, interaction.user.id, voteType, interaction);
  },
};
