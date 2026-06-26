import { MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { ReportsRepo } from '../../database/repositories/reports.repo.js';
import { botConfig as config } from '../../helpers/configHelper.js';
import { createV2Container, v2Payload, v2EditPayload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

export default {
  customId: 'report:reject',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const reportId = parseInt(parts[2]);

    if (isNaN(reportId)) {
      await interaction.reply({ content: `${emojis.error} Invalid report ID.`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferUpdate();

    try {
      const db = getDb();
      const report = ReportsRepo.getById(db, reportId);

      if (!report) {
        await interaction.followUp({ content: `${emojis.error} Report not found in database.`, flags: MessageFlags.Ephemeral });
        return;
      }

      // Update DB status to rejected
      ReportsRepo.updateStatus(db, reportId, 'rejected', interaction.user.id);

      const reporter = await client.users.fetch(report.user_id).catch(() => null);
      const reporterTag = reporter ? reporter.tag : 'Unknown';

      // DM reporter
      try {
        if (reporter) {
          const reporterContainer = createV2Container({
            title: `❌ Issue Rejected`,
            description: `Your reported issue **#${reportId}** has been reviewed and rejected by the administration.`,
            color: config.colors.error,
            fields: [
              { name: 'Report ID', value: `\`#${reportId}\`` },
              { name: 'Status', value: `❌ Rejected` },
            ],
            client,
          });

          await reporter.send(v2Payload(reporterContainer));
        }
      } catch (err) {
        logger.warn('REPORT_DM', `Failed to DM reporter ${report.user_id} about report rejection: ${err.message}`);
      }

      // Update admin DM container
      const dmContainer = createV2Container({
        title: `⚠️ New Problem Report (#${reportId})`,
        color: config.colors.error, // red
        description: `A user has reported a problem via the help menu.`,
        fields: [
          { name: 'Report ID', value: `\`#${reportId}\`` },
          { name: 'Reporter', value: `<@${report.user_id}> (${reporterTag})` },
          { name: 'Reporter ID', value: `\`${report.user_id}\`` },
          { name: 'Status', value: `❌ Rejected` },
          { name: 'Description', value: report.problem },
        ],
        client,
      });

      await interaction.editReply(v2EditPayload(dmContainer, []));

      logger.info('REPORT', `Report #${reportId} rejected by admin.`);
    } catch (error) {
      logger.error('REPORT_REJECT', `Error executing report reject: ${error.message}`, error);
    }
  },
};
