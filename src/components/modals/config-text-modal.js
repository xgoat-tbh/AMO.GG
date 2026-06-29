import { MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { ConfigRepo } from '../../database/repositories/config.repo.js';
import { renderDashboard } from '../../commands/admin/config.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'config:text_save',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];
    const sectionKey = parts[3];
    const settingKey = parts.slice(4).join(':');

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({ content: `${emojis.error} Not your config session.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const value = interaction.fields.getTextInputValue('config_text_value');

    try {
      const db = getDb();
      ConfigRepo.set(db, settingKey, value);

      const payload = renderDashboard(client, executorId, sectionKey);
      await interaction.update(payload);

      await interaction.followUp({
        content: `${emojis.success} Updated \`${settingKey}\` to **${value}**.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        content: `${emojis.error} Failed to save: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
