import { MessageFlags } from 'discord.js';
import { renderHelp } from '../../commands/utility/help.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'help:page',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[parts.length - 1];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the help command can use this.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const action = parts[2];
    const category = parts[3];
    const page = parseInt(parts[4], 10) || 1;

    let newPage = page;
    if (action === 'prev') newPage = page - 1;
    else if (action === 'next') newPage = page + 1;

    await interaction.deferUpdate();
    const payload = renderHelp(client, interaction.member, 'category', { category, page: newPage });
    await interaction.editReply(payload);
  },
};