import { MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { renderHelp } from '../../commands/utility/help.js';
import { CATEGORY_ORDER } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'help:nav',

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

    const action = parts[3];

    await interaction.deferUpdate();

    switch (action) {
      case 'home': {
        const payload = renderHelp(client, interaction.member, 'home');
        await interaction.editReply(payload);
        break;
      }

      case 'all': {
        const page = parseInt(parts[4], 10) || 1;
        const payload = renderHelp(client, interaction.member, 'all', { page });
        await interaction.editReply(payload);
        break;
      }

      case 'prev_cat':
      case 'next_cat': {
        const currentCat = parts[4];
        const currentPage = parseInt(parts[5], 10) || 1;
        const idx = CATEGORY_ORDER.indexOf(currentCat);
        const delta = action === 'prev_cat' ? -1 : 1;
        const newIdx = Math.max(0, Math.min(CATEGORY_ORDER.length - 1, idx + delta));
        const newCat = CATEGORY_ORDER[newIdx];
        const payload = renderHelp(client, interaction.member, 'category', { category: newCat, page: 1 });
        await interaction.editReply(payload);
        break;
      }

      default:
        break;
    }
  },
};