import { MessageFlags } from 'discord.js';
import { renderDashboard } from '../../commands/admin/config.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'config:refresh',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];
    const sectionKey = parts[3] || null;
    const activeSetting = parts[4] || null;

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the config command can refresh.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const payload = renderDashboard(client, executorId, sectionKey, activeSetting);
      await interaction.update(payload);
    } catch (error) {
      await interaction.reply({
        content: `${emojis.error} Failed to refresh configuration.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
