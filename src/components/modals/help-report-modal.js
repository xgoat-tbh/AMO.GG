import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { ReportsRepo } from '../../database/repositories/reports.repo.js';
import { botConfig as config } from '../../helpers/configHelper.js';
import { createV2Container, createV2Success, createV2Error, v2Payload, v2EditPayload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

/**
 * Resolves the owner user account dynamically by username 'xgoat.tbh'.
 */
async function resolveOwner(client) {
  // 1. Try cache
  let owner = client.users.cache.find((u) => u.username === 'xgoat.tbh');
  if (owner) return owner;

  // 2. Try fetching from the configured primary guild
  const guildId = config.guildId;
  if (guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      try {
        const members = await guild.members.fetch();
        const member = members.find((m) => m.user.username === 'xgoat.tbh');
        if (member) return member.user;
      } catch (err) {
        logger.error('REPORT_MODAL', `Failed to fetch members for owner resolution: ${err.message}`);
      }
    }
  }

  // 3. Fallback to searching all client guilds
  for (const [, guild] of client.guilds.cache) {
    try {
      const members = await guild.members.fetch();
      const member = members.find((m) => m.user.username === 'xgoat.tbh');
      if (member) return member.user;
    } catch {
      continue;
    }
  }

  return null;
}

export default {
  customId: 'help:report_modal',

  async execute(interaction, client) {
    const problemDesc = interaction.fields.getTextInputValue('problem_desc');

    if (!problemDesc || !problemDesc.trim()) {
      const errContainer = createV2Error(`${emojis.error} Description cannot be empty.`, client);
      await interaction.reply({
        ...v2Payload(errContainer, [], true)
      });
      return;
    }

    // Defer reply as we will perform async user fetches and database writes
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const db = getDb();

      // Create database record
      const report = ReportsRepo.create(db, interaction.user.id, problemDesc.trim());
      const reportId = report.id;

      // Locate owner @xgoat.tbh
      const owner = await resolveOwner(client);
      if (!owner) {
        logger.error('REPORT_MODAL', `Could not find owner user xgoat.tbh to send report #${reportId}`);
        const errContainer = createV2Error(`${emojis.error} Report created as **#${reportId}**, but I could not locate the bot administrator (@xgoat.tbh) to deliver it. Please contact them directly.`, client);
        await interaction.editReply(v2EditPayload(errContainer));
        return;
      }

      // Build container for owner's DMs
      const dmContainer = createV2Container({
        title: `⚠️ New Problem Report (#${reportId})`,
        color: config.colors.warning,
        description: `A user has reported a problem via the help menu.`,
        fields: [
          { name: 'Report ID', value: `\`#${reportId}\`` },
          { name: 'Reporter', value: `<@${interaction.user.id}> (${interaction.user.tag})` },
          { name: 'Reporter ID', value: `\`${interaction.user.id}\`` },
          { name: 'Guild', value: interaction.guild ? `${interaction.guild.name} (\`${interaction.guild.id}\`)` : 'Direct Message' },
          { name: 'Reported At', value: `<t:${Math.floor(Date.now() / 1000)}:F>` },
          { name: 'Status', value: `⏳ Pending Review` },
          { name: 'Description', value: problemDesc.trim() },
        ],
        client,
      });

      // Add accept/reject buttons
      const acceptBtn = new ButtonBuilder()
        .setCustomId(`report:accept:${reportId}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

      const rejectBtn = new ButtonBuilder()
        .setCustomId(`report:reject:${reportId}`)
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');

      const row = new ActionRowBuilder().addComponents(acceptBtn, rejectBtn);

      // Send to owner DM
      try {
        await owner.send({
          ...v2Payload(dmContainer, [row]),
        });

        const successContainer = createV2Success(`${emojis.success} Your problem report has been submitted as **#${reportId}**. The administrator has been notified.`, client);
        await interaction.editReply(v2EditPayload(successContainer));
        logger.info('REPORT', `Report #${reportId} submitted by ${interaction.user.id} and sent to owner DMs.`);
      } catch (dmErr) {
        logger.error('REPORT_MODAL', `Failed to send DM to owner: ${dmErr.message}`);
        const warnContainer = createV2Container({
          description: `${emojis.warning} Report created as **#${reportId}**, but I failed to DM the administrator. Please make sure their DMs are open and message them directly.`,
          color: config.colors.warning,
          client,
        });
        await interaction.editReply(v2EditPayload(warnContainer));
      }
    } catch (error) {
      logger.error('REPORT_MODAL', `Unexpected error handling report modal: ${error.message}`, error);
      const errContainer = createV2Error(`${emojis.error} An unexpected error occurred while processing your report.`, client);
      await interaction.editReply(v2EditPayload(errContainer));
    }
  },
};
