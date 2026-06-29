import { MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';
import { logModeration } from '../../services/loggingService.js';
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  customId: 'admin:reset_confirm',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const authorId = parts[2];

    if (interaction.user.id !== authorId) {
      await interaction.reply({
        content: `${emojis.error} Only the administrator who initiated the command can confirm this reset.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();

    try {
      const db = getDb();

      // Wipe tables
      db.exec('DELETE FROM confessions');
      db.exec('DELETE FROM suggestions');
      db.exec('DELETE FROM suggestion_votes');
      db.exec('DELETE FROM voice_lockdown_state');
      db.exec('DELETE FROM role_audit_log');
      db.exec('DELETE FROM temp_vcs');
      db.exec('DELETE FROM bot_config');
      db.exec('DELETE FROM gameping_aliases');
      db.exec('DELETE FROM jail_records');
      db.exec('DELETE FROM jail_stored_roles');
      db.exec('DELETE FROM giveaways');
      db.exec('DELETE FROM giveaway_entries');
      db.exec('DELETE FROM booster_roles');
      db.exec('DELETE FROM blacklist');

      // Clear combined log file
      const logFile = join(__dirname, '..', '..', '..', 'logs', 'combined.log');
      try {
        if (fs.existsSync(logFile)) {
          fs.writeFileSync(logFile, '', 'utf8');
        }
      } catch (err) {
        logger.error('RESET', `Failed to clear combined.log: ${err.message}`);
      }

      logger.success('RESET', `System reset initiated by user ${interaction.user.id} completed successfully.`);

      await logModeration(client, {
        action: 'database_reset',
        moderator: interaction.user,
        reason: 'Full database reset performed',
      });

      try { await interaction.message.delete(); } catch {}

      const successContainer = createV2Success(
        `${emojis.success} All database tables have been cleared and logs have been wiped successfully.`,
        client
      );

      await interaction.followUp({
        ...v2Payload(successContainer, [], true),
      });
    } catch (error) {
      logger.error('RESET', `Error performing reset: ${error.message}`, error);

      try { await interaction.message.delete(); } catch {}

      const errContainer = createV2Error(
        `${emojis.error} An error occurred while resetting the database: ${error.message}`,
        client
      );

      await interaction.followUp({
        ...v2Payload(errContainer, [], true),
      });
    }
  },
};
