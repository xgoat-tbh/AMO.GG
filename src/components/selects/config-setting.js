import { MessageFlags } from 'discord.js';
import { renderDashboard } from '../../commands/admin/config.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'config:setting',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];
    const sectionKey = parts[3];
    const settingKey = interaction.values?.[0];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the config command can edit settings.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!sectionKey || !settingKey) {
      await interaction.reply({ content: `${emojis.error} Invalid setting.`, flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      const payload = renderDashboard(client, executorId, sectionKey, settingKey);
      await interaction.update(payload);
    } catch (error) {
      await interaction.reply({
        content: `${emojis.error} Failed to open setting editor.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
