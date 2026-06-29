import { MessageFlags } from 'discord.js';
import { getChannelSnipes } from '../../systems/snipe/snipeManager.js';
import { buildMessagesPage } from '../selects/snipe-user.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'snipe:page',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];
    const userId = parts[3];
    const currentPage = parseInt(parts[4], 10);
    const direction = parts[5];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the snipe command can use this menu.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const snipes = getChannelSnipes(interaction.channel.id);
    const userMessages = snipes.filter(m => m.author.id === userId);

    if (!userMessages.length) {
      await interaction.reply({
        content: `${emojis.error} No deleted messages found for this user.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const totalPages = Math.ceil(userMessages.length / 5);
    let newPage = currentPage;
    if (direction === 'prev') newPage = Math.max(1, currentPage - 1);
    if (direction === 'next') newPage = Math.min(totalPages, currentPage + 1);

    await interaction.deferUpdate();

    const payload = buildMessagesPage(userMessages, executorId, newPage, client);
    await interaction.editReply(payload);
  },
};
