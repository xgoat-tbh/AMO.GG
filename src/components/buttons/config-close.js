import { MessageFlags } from 'discord.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

export default {
  customId: 'config:close',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the config command can close this dashboard.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await interaction.message.delete();
      logger.info('CONFIG', `Admin ${interaction.user.id} closed the configuration dashboard.`);
    } catch (error) {
      logger.error('CONFIG_CLOSE', `Failed to delete configuration message: ${error.message}`, error);
    }
  },
};
