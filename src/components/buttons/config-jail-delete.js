import { MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { ConfigRepo } from '../../database/repositories/config.repo.js';
import { renderDashboard } from '../../commands/admin/config.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

export default {
  customId: 'config:jail_delete',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the config command can manage jail settings.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();

    try {
      const guild = interaction.guild;
      const db = getDb();

      const existingRoleId = ConfigRepo.get(db, 'jail_role_id');
      if (!existingRoleId) {
        await interaction.followUp({
          content: `${emojis.warning} No jail role is configured. There's nothing to delete.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const role = guild.roles.cache.get(existingRoleId);
      if (role) {
        await role.delete(`Jail role deleted by ${interaction.user.tag}`);
      }

      // Clear config
      ConfigRepo.delete(db, 'jail_role_id');

      // Re-render dashboard
      const payload = renderDashboard(client, executorId);
      await interaction.editReply(payload);

      await interaction.followUp({
        content: `${emojis.success} Deleted the jailed role and cleared the configuration.`,
        flags: MessageFlags.Ephemeral,
      });

      logger.info('JAIL', `Admin ${interaction.user.id} deleted jailed role.`);
    } catch (error) {
      logger.error('JAIL_DELETE', `Failed to delete jail role: ${error.message}`, error);
      await interaction.followUp({
        content: `${emojis.error} Failed to delete jail role: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
