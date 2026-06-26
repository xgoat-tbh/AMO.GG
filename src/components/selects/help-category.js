import { MessageFlags } from 'discord.js';
import { renderHelp } from '../../commands/utility/help.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'help:category',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[parts.length - 1];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the help command can use this menu.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const category = interaction.values[0];
    if (!category) {
      await interaction.reply({ content: `${emojis.error} No category selected.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const payload = renderHelp(client, interaction.member, category, 1, 'asc', null);
    await interaction.update(payload);
  },
};
