import { MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { ConfigRepo } from '../../database/repositories/config.repo.js';
import { renderDashboard } from '../../commands/admin/config.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

export default {
  customId: 'config:perm_set',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const settingKey = parts[2];
    const executorId = parts[3];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the config command can configure settings.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!settingKey) {
      await interaction.reply({ content: `${emojis.error} Could not identify setting key.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const value = interaction.values[0];

    try {
      const db = getDb();
      ConfigRepo.set(db, settingKey, value);

      // Re-render dashboard payload (activeSetting: null to reset select menus)
      const payload = renderDashboard(client, executorId, null);

      await interaction.update(payload);
      await interaction.followUp({
        content: `${emojis.success} Successfully updated setting \`${settingKey}\` to **${value}**.`,
        flags: MessageFlags.Ephemeral,
      });

      logger.info('CONFIG', `Admin ${interaction.user.id} updated config "${settingKey}" to "${value}"`);
    } catch (error) {
      logger.error('CONFIG_PERM_SET', `Failed to save configuration override: ${error.message}`, error);
      await interaction.reply({
        content: `${emojis.error} Failed to save configuration override to the database.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
