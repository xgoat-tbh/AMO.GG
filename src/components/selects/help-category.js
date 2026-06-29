import { MessageFlags } from 'discord.js';
import { renderHelp } from '../../commands/utility/help.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'help:category',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the help command can use this menu.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const category = interaction.values[0];
    if (!category) {
      await interaction.reply({
        content: `${emojis.error} No category selected.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    const payload = renderHelp(client, interaction.member, 'category', { category, page: 1 });
    await interaction.editReply(payload);
  },
};