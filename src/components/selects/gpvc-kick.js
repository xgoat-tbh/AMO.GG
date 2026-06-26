import { MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { TempVcsRepo } from '../../database/repositories/tempVcs.repo.js';
import { createV2Success, createV2Error, v2Payload, v2EditPayload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

export default {
  customId: 'gpvc:select_kick',

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

    // Security check: creator only
    if (interaction.user.id !== record.creator_id) {
      await interaction.reply({
        content: `${emojis.error} Only the owner of this voice channel (<@${record.creator_id}>) can manage it.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) {
      await interaction.reply({ content: `${emojis.error} Voice channel not found.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const targetUserId = interaction.values[0];
    const targetMember = channel.members.get(targetUserId);

    if (!targetMember) {
      await interaction.reply({
        content: `${emojis.error} That member is no longer in this voice channel.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();

    try {
      await targetMember.voice.disconnect('Kicked by VC owner');
      
      const successContainer = createV2Success(
        `${emojis.success} Successfully kicked **${targetMember.user.tag}** from the voice channel.`,
        client
      );
      await interaction.editReply(v2EditPayload(successContainer, []));
    } catch (error) {
      logger.error('GPVC_KICK', `Failed to kick member: ${error.message}`);
      const errorContainer = createV2Error(
        `${emojis.error} Failed to kick member: ${error.message}`,
        client
      );
      await interaction.editReply(v2EditPayload(errorContainer, []));
    }
  },
};
