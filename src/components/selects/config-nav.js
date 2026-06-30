import { MessageFlags } from 'discord.js';
import { renderDashboard } from '../../commands/admin/config.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'config:nav',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];
    const sectionKey = interaction.values?.[0];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the config command can navigate settings.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!sectionKey) {
      await interaction.reply({ content: `${emojis.error} Invalid section.`, flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      const payload = renderDashboard(client, executorId, sectionKey);
      await interaction.update(payload);
    } catch (error) {
      await interaction.reply({
        content: `${emojis.error} Failed to navigate to section.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
