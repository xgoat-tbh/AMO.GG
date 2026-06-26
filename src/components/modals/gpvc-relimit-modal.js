import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { TempVcsRepo } from '../../database/repositories/tempVcs.repo.js';
import { buildInterfaceContainer, buildInterfaceRows } from '../../systems/voice/tempVcManager.js';
import { v2Payload, v2EditPayload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';

export default {
  customId: 'gpvc:modal_relimit',

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

    const limitRaw = interaction.fields.getTextInputValue('vc_new_limit');
    const parsed = parseInt(limitRaw?.trim(), 10);

    if (isNaN(parsed) || parsed < 0 || parsed > 99) {
      await interaction.reply({
        content: `${emojis.error} User limit must be a number between 0 and 99.`,
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
      // Save limit in DB
      TempVcsRepo.updateLimit(db, channelId, parsed);

      // Update in Discord
      await channel.setUserLimit(parsed);

      // Update control panel
      const everyoneRole = interaction.guild.roles.everyone;
      const isLocked = channel.permissionOverwrites.cache.get(everyoneRole.id)?.deny.has(PermissionFlagsBits.Connect) ?? false;

      const interfaceContainer = buildInterfaceContainer(record.creator_id, record.game, parsed, isLocked, record.name, client);
      const rows = buildInterfaceRows(channelId, isLocked);

      await interaction.editReply(v2EditPayload(interfaceContainer, rows));
    } catch (error) {
      logger.error('GPVC_RELIMIT', `Failed to edit user limit: ${error.message}`);
    }
  },
};
