import { MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { TempVcsRepo } from '../../database/repositories/tempVcs.repo.js';
import { buildInterfaceContainer, buildInterfaceRows } from '../../systems/voice/tempVcManager.js';
import { createV2Success, v2Payload, v2EditPayload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';
import { PermissionFlagsBits } from 'discord.js';

export default {
  customId: 'gpvc:select_regame',

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

    const selectedGame = interaction.values[0];
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) {
      await interaction.reply({ content: `${emojis.error} Voice channel not found.`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferUpdate();

    try {
      // Update Game in DB
      TempVcsRepo.updateGame(db, channelId, selectedGame);

      // Update name in Discord (always the game name, no emojis)
      const finalName = selectedGame ? selectedGame : 'Lounge';
      await channel.setName(finalName);

      // Update the ephemeral menu response to success
      const successContainer = createV2Success(
        `${emojis.success} Channel game has been successfully updated to **${selectedGame}**.`,
        client
      );
      await interaction.editReply(v2EditPayload(successContainer, []));

      // Find and update the persistent control panel message in the voice text channel
      const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
      if (messages) {
        const interfaceMsg = messages.find(
          m => m.author.id === client.user.id &&
               m.components?.length > 0 &&
               m.components[0].components[0].customId?.startsWith('gpvc:manage')
        );

        if (interfaceMsg) {
          const everyoneRole = interaction.guild.roles.everyone;
          const isLocked = channel.permissionOverwrites.cache.get(everyoneRole.id)?.deny.has(PermissionFlagsBits.Connect) ?? false;

          const interfaceContainer = buildInterfaceContainer(record.creator_id, selectedGame, record.user_limit, isLocked, record.name, client);
          const rows = buildInterfaceRows(channelId, isLocked);

          await interfaceMsg.edit(v2EditPayload(interfaceContainer, rows));
        }
      }
    } catch (error) {
      logger.error('GPVC_REGAME', `Failed to update game: ${error.message}`);
    }
  },
};
