import { MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { ConfigRepo } from '../../database/repositories/config.repo.js';
import { renderDashboard } from '../../commands/admin/config.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

export default {
  customId: 'config:clear',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the config command can clear overrides.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Acknowledge and defer the update
    await interaction.deferUpdate();

    try {
      const db = getDb();
      ConfigRepo.clearAll(db);

      // Re-render dashboard payload
      const payload = renderDashboard(client, executorId);

      await interaction.editReply(payload);
      await interaction.followUp({
        content: `${emojis.success} All configuration overrides have been cleared. Using default configurations.`,
        flags: MessageFlags.Ephemeral,
      });

      logger.info('CONFIG', `Admin ${interaction.user.id} cleared all configuration overrides.`);
    } catch (error) {
      logger.error('CONFIG_CLEAR', `Failed to clear configuration overrides: ${error.message}`, error);
      await interaction.followUp({
        content: `${emojis.error} Failed to clear configuration overrides from the database.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
