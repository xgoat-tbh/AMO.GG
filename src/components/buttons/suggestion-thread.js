import { MessageFlags } from 'discord.js';
import { createThread } from '../../systems/suggestions/suggestionManager.js';

export default {
  customId: 'suggestion:thread',

  async execute(interaction) {
    // Parse customId: 'suggestion:thread:123'
    const parts = interaction.customId.split(':');
    const suggestionId = parseInt(parts[2], 10);

    if (isNaN(suggestionId)) {
      await interaction.reply({ content: '❌ Invalid suggestion data.', flags: MessageFlags.Ephemeral });
      return;
    }

    await createThread(suggestionId, interaction);
  },
};
