import { MessageFlags } from 'discord.js';
import { handleVote } from '../../systems/suggestions/suggestionManager.js';

export default {
  customId: 'suggestion:vote',

  async execute(interaction) {
    // Parse customId: 'suggestion:vote:yes:123' or 'suggestion:vote:no:123'
    const parts = interaction.customId.split(':');
    const voteType = parts[2]; // 'yes' or 'no'
    const suggestionId = parseInt(parts[3], 10);

    if (!voteType || !['yes', 'no'].includes(voteType) || isNaN(suggestionId)) {
      await interaction.reply({ content: '❌ Invalid vote data.', flags: MessageFlags.Ephemeral });
      return;
    }

    await handleVote(suggestionId, interaction.user.id, voteType, interaction);
  },
};
