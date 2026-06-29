import { MessageFlags } from 'discord.js';
import { renderHelp } from '../../commands/utility/help.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'help:search',

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

    const selectedCmd = interaction.values[0];
    if (!selectedCmd) {
      await interaction.reply({
        content: `${emojis.error} No command selected.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const cmd = client.commands.get(selectedCmd);
    if (!cmd) {
      await interaction.reply({
        content: `${emojis.error} Command \`${selectedCmd}\` not found.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    const payload = renderHelp(client, interaction.member, 'command', { command: cmd });
    await interaction.editReply(payload);
  },
};