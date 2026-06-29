import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { CONFIG_SECTIONS } from '../../config/configSections.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'config:text_edit',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];
    const sectionKey = parts[3];
    const settingKey = parts.slice(4).join(':');

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({ content: `${emojis.error} Not your config session.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const section = CONFIG_SECTIONS[sectionKey];
    const settingDef = section?.settings[settingKey];
    if (!settingDef) {
      await interaction.reply({ content: `${emojis.error} Setting not found.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`config:text_save:${executorId}:${sectionKey}:${settingKey}`)
      .setTitle(`Set ${settingDef.label}`)
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('config_text_value')
            .setLabel(settingDef.description || settingDef.label)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder(`Enter value for ${settingDef.label}...`)
        )
      );

    await interaction.showModal(modal);
  },
};
