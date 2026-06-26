import { MessageFlags } from 'discord.js';
import { renderDashboard } from '../../commands/admin/config.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'config:select',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the config command can use this menu.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const settingKey = interaction.values[0];

    if (!settingKey) {
      await interaction.reply({ content: 'No setting selected.', flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      // Re-render dashboard payload with active setting key
      const payload = renderDashboard(client, executorId, settingKey);

      // Update the message dynamically
      await interaction.update(payload);
    } catch (error) {
      await interaction.reply({
        content: `${emojis.error} Failed to update the dashboard.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
