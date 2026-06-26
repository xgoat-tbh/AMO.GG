import { MessageFlags } from 'discord.js';
import { renderHelp } from '../../commands/utility/help.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'help:btn_home',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[parts.length - 1];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the help command can use this button.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const payload = renderHelp(client, interaction.member, 'utility', 1, 'asc', null);
    await interaction.update(payload);
  },
};
