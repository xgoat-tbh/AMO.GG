import { MessageFlags } from 'discord.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'list_pagination',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[1];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the command can use this.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const action = parts[2];
    const currentPage = parseInt(parts[3], 10);
    const totalPages = parseInt(parts[4], 10);

    // Parse extra data
    let extra = {};
    try {
      extra = JSON.parse(parts.slice(5).join(':'));
    } catch {}

    let newPage = currentPage;
    if (action === 'prev') newPage = Math.max(1, currentPage - 1);
    if (action === 'next') newPage = Math.min(totalPages, currentPage + 1);

    // We can't reconstruct the full payload here since list data isn't stored.
    // The command that created this pagination must re-render its content.
    // This handler is a placeholder that re-imports and re-runs the original command.
    // For now, just reply with a message about how to refresh.
    await interaction.reply({
      content: `${emojis.warning} Pagination expired. Re-run the command with \`?command ${newPage}\` to view page ${newPage}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};