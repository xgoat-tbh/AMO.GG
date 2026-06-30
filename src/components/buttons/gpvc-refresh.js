import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { TempVcsRepo } from '../../database/repositories/tempVcs.repo.js';
import { v2EditPayload } from '../../helpers/v2Helper.js';
import { buildInterfaceContainer, buildInterfaceRows } from '../../systems/voice/tempVcManager.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'gpvc:refresh',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const channelId = parts[2];

    const db = getDb();
    const record = TempVcsRepo.get(db, channelId);

    if (!record) {
      await interaction.reply({
        content: `${emojis.error} This temporary voice channel is no longer tracked.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.guild.channels.cache.get(channelId);
    const isLocked = channel?.permissionOverwrites.cache
      .get(interaction.guild.roles.everyone.id)
      ?.deny.has(PermissionFlagsBits.Connect) ?? false;

    const container = buildInterfaceContainer(record.creator_id, record.game, record.user_limit, isLocked, record.name, client);
    const rows = buildInterfaceRows(channelId, isLocked);

    await interaction.update(v2EditPayload(container, rows));
  },
};
