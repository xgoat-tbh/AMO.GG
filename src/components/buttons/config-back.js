import { MessageFlags } from 'discord.js';
import { renderDashboard } from '../../commands/admin/config.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'config:back',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the config command can navigate back.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const payload = renderDashboard(client, executorId, null);
      await interaction.update(payload);
    } catch (error) {
      await interaction.reply({
        content: `${emojis.error} Failed to return to home.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
