import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { TempVcsRepo } from '../../database/repositories/tempVcs.repo.js';
import { buildInterfaceContainer, buildInterfaceRows } from '../../systems/voice/tempVcManager.js';
import { v2Payload, v2EditPayload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';
import { sanitizeContent } from '../../helpers/sanitizer.js';

export default {
  customId: 'gpvc:modal_status',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const channelId = parts[2];

    const db = getDb();
    const record = TempVcsRepo.get(db, channelId);

    if (!record) {
      await interaction.reply({
        content: `${emojis.error} This channel is no longer tracked.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const statusInput = interaction.fields.getTextInputValue('vc_new_status') || '';

    // Validate and sanitize
    const { sanitized: newStatus, valid, reason } = sanitizeContent(statusInput, 500, 'Channel status');
    if (statusInput && !valid) {
      await interaction.reply({
        content: `${emojis.error} ${reason}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) {
      await interaction.reply({ content: `${emojis.error} Voice channel not found.`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferUpdate();

    try {
      TempVcsRepo.updateName(db, channelId, newStatus);

      await client.rest.put(`/channels/${channelId}/voice-status`, {
        body: { status: newStatus }
      }).catch(err => {
        logger.warn('GPVC_STATUS', `Could not set Discord voice status: ${err.message}`);
      });

      const everyoneRole = interaction.guild.roles.everyone;
      const isLocked = channel.permissionOverwrites.cache.get(everyoneRole.id)?.deny.has(PermissionFlagsBits.Connect) ?? false;

      const interfaceContainer = buildInterfaceContainer(
        record.creator_id,
        record.game,
        record.user_limit,
        isLocked,
        newStatus,
        client
      );
      const rows = buildInterfaceRows(channelId, isLocked);

      await interaction.editReply(v2EditPayload(interfaceContainer, rows));
    } catch (error) {
      logger.error('GPVC_STATUS', `Failed to update status: ${error.message}`);
    }
  },
};
