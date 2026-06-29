import { MessageFlags } from 'discord.js';
import { renderHelp } from '../../commands/utility/help.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'help:back',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the help command can use this.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const category = parts[3] || 'utility';
    const page = parseInt(parts[4], 10) || 1;

    await interaction.deferUpdate();
    const payload = renderHelp(client, interaction.member, 'category', { category, page });
    await interaction.editReply(payload);
  },
};