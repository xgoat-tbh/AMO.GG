import { MessageFlags } from 'discord.js';
import { renderHelp } from '../../commands/utility/help.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'help:command',

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

    const selectedCmd = interaction.values[0];
    if (!selectedCmd) {
      await interaction.reply({ content: `${emojis.error} No command selected.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const category = parts[2];
    const page = parseInt(parts[3], 10) || 1;
    const sortOrder = parts[4] || 'asc';

    await interaction.deferUpdate();
    const payload = renderHelp(client, interaction.member, category, page, sortOrder, selectedCmd);
    await interaction.editReply(payload);
  },
};
