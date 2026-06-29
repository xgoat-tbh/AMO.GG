import { MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { ConfigRepo } from '../../database/repositories/config.repo.js';
import { renderDashboard } from '../../commands/admin/config.js';
import { CONFIG_SECTIONS } from '../../config/configSections.js';
import { emojis } from '../../config/emojis.config.js';
import { logger } from '../../helpers/logger.js';
import { validateConfigValue } from '../../helpers/configValidator.js';

export default {
  customId: 'config:section_set',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];
    const sectionKey = parts[3];
    const settingKey = parts.slice(4).join(':');

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the config command can configure settings.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!sectionKey || !settingKey) {
      await interaction.reply({ content: `${emojis.error} Could not identify setting.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const section = CONFIG_SECTIONS[sectionKey];
    if (!section) {
      await interaction.reply({ content: `${emojis.error} Invalid section.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const settingDef = section.settings[settingKey];
    if (!settingDef) {
      await interaction.reply({ content: `${emojis.error} Invalid setting key.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const values = interaction.values;
    let storedValue;

    switch (settingDef.type) {
      case 'roles':
        storedValue = values.join(',');
        break;
      case 'role':
      case 'channel':
      case 'category':
      case 'select':
      default:
        storedValue = values[0];
        break;
    }

    const validation = await validateConfigValue(client, interaction.guildId, settingKey, storedValue);
    if (!validation.valid) {
      await interaction.reply({
        content: `${emojis.error} Invalid value: ${validation.reason}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const db = getDb();
      ConfigRepo.set(db, settingKey, storedValue);

      const payload = renderDashboard(client, executorId, sectionKey, null);

      const displayValue = settingDef.type === 'roles'
        ? values.map(id => `<@&${id}>`).join(', ')
        : (settingDef.type === 'channel' || settingDef.type === 'category')
          ? `<#${storedValue}>`
          : (settingDef.type === 'role')
            ? `<@&${storedValue}>`
            : `\`${storedValue}\``;

      await interaction.update(payload);
      await interaction.followUp({
        content: `${emojis.success} **${settingDef.label}** updated to ${displayValue}.`,
        flags: MessageFlags.Ephemeral,
      });

      logger.info('CONFIG', `Admin ${interaction.user.id} updated "${settingKey}" to "${storedValue}"`);
    } catch (error) {
      logger.error('CONFIG_SET', `Failed to save configuration: ${error.message}`, error);
      await interaction.reply({
        content: `${emojis.error} Failed to save configuration to the database.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
