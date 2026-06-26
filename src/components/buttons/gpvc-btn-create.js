import { MessageFlags } from 'discord.js';
import { pendingVcs } from '../../commands/voice/gpvc.js';
import { createTempVc } from '../../systems/voice/tempVcManager.js';
import { createV2Success, createV2Error, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

import { getDb } from '../../database/connection.js';

export default {
  customId: 'gpvc:btn_create',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const userId = parts[2];

    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: `${emojis.error} This configuration menu does not belong to you.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const state = pendingVcs.get(userId);
    if (!state) {
      await interaction.reply({
        content: `${emojis.error} Configuration session not found. Please run \`?gpvc\` again.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!state.game) {
      await interaction.reply({
        content: `${emojis.error} **Selecting a game is mandatory!** Please select a game from the dropdown menu first.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();

    try {
      // Create the VC
      const channel = await createTempVc(interaction.member, state.name, state.limit, state.game, client);

      // Clean up cache
      pendingVcs.delete(userId);

      // Move member to the newly created channel if they are in a voice channel
      let moved = false;
      if (interaction.member.voice.channel) {
        try {
          await interaction.member.voice.setChannel(channel);
          moved = true;
        } catch (moveErr) {
          logger.warn('GPVC_MOVE', `Failed to move creator ${interaction.user.tag} to channel: ${moveErr.message}`);
        }
      }

      // Delete original configuration menu message
      try { await interaction.message.delete(); } catch {}

      const successContainer = createV2Success(
        `${emojis.success} Voice channel **${channel.name}** has been created successfully!\n\n${
          moved
            ? '🔊 *You have been automatically moved into your new channel.*'
            : `🔊 *Join your channel here: <#${channel.id}>*`
        }`,
        client
      );

      await interaction.followUp({
        ...v2Payload(successContainer, [], true),
      });


    } catch (error) {
      logger.error('GPVC_CREATE', `Failed to create temp voice channel: ${error.message}`, error);
      const errContainer = createV2Error(
        `${emojis.error} Failed to create voice channel: ${error.message}`,
        client
      );
      await interaction.followUp({
        ...v2Payload(errContainer, [], true),
      });
    }
  },
};
