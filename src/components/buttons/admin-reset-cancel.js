import { MessageFlags, EmbedBuilder } from 'discord.js';
import { v2Payload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'admin:reset_cancel',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const authorId = parts[2];

    if (interaction.user.id !== authorId) {
      await interaction.reply({
        content: `${emojis.error} Only the administrator who initiated the command can cancel this reset.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    try { await interaction.message.delete(); } catch {}

    const embed = new EmbedBuilder()
      .setDescription(`${emojis.error} The database reset operation was cancelled.`)
      .setColor(config.colors.warning);

    await interaction.followUp({
      ...v2Payload(embed, [], true),
    });
  },
};
