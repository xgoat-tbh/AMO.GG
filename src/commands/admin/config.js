import { ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { ConfigRepo } from '../../database/repositories/config.repo.js';
import { botConfig as config, getConfig } from '../../helpers/configHelper.js';
import { createV2Container, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { handleCommandError } from '../../helpers/errorHandler.js';

/**
 * Renders the configuration dashboard embed and components.
 * Exported so other component handlers can use it to re-render the view.
 */
export function renderDashboard(client, executorId = '', activeSetting = null) {
  const db = getDb();
  const overrides = ConfigRepo.getAll(db);

  // Helper to format values with override indicator
  const formatSetting = (path, dbKey, type = 'channel') => {
    const isOverride = overrides[dbKey] !== undefined && overrides[dbKey] !== null;
    const value = getConfig(path);
    const sourceTag = isOverride ? '`[Override]`' : '`[Default]`';

    if (!value) return `❌ *Not Set* ${sourceTag}`;

    if (type === 'channel') {
      return `<#${value}> (\`${value}\`)\n${sourceTag}`;
    } else if (type === 'role') {
      return `<@&${value}> (\`${value}\`)\n${sourceTag}`;
    } else if (path === 'gamepingPermission') {
      const permEmojis = {
        everyone: emojis.general || '👥',
        moderator: emojis.moderation || '⚒️',
        admin: emojis.admin || '⚙️',
      };
      const emoji = permEmojis[value] || '⚙️';
      return `${emoji} \`${value}\`\n${sourceTag}`;
    }
    return `\`${value}\`\n${sourceTag}`;
  };

  const container = createV2Container({
    title: `${emojis.admin} Amo.GG Configuration Dashboard`,
    color: config.colors.primary,
    description: `Manage runtime overrides for channel routing, logging, and mod roles.\n\n• Use the dropdown to select a setting to edit.\n• Click **Clear Config Overrides** to reset database values back to \`.env\` defaults.`,
    fields: [
      { name: '💡 Suggestions Channel', value: formatSetting('channels.suggestion', 'suggestion_channel'), inline: true },
      { name: '📝 Confessions Channel', value: formatSetting('channels.confession', 'confession_channel'), inline: true },
      { name: '📜 Logs Channel', value: formatSetting('channels.log', 'log_channel'), inline: true },
      { name: '⛓️ Jail Role ID', value: formatSetting('jailRoleId', 'jail_role_id', 'role'), inline: true },
      { name: '🎮 GamePing Role', value: formatSetting('gamepingRoleId', 'gameping_role_id', 'role'), inline: true },
      { name: '⚙️ GamePing Permission', value: formatSetting('gamepingPermission', 'gameping_permission', 'text'), inline: true },
    ],
    client,
  });

  const options = [
    { emoji: '💡', label: 'Suggestions Channel', description: 'Configure suggestions posting channel', value: 'suggestion_channel' },
    { emoji: '📝', label: 'Confessions Channel', description: 'Configure confessions posting channel', value: 'confession_channel' },
    { emoji: '📜', label: 'Logs Channel', description: 'Configure unified system logs channel', value: 'log_channel' },
    { emoji: '⛓️', label: 'Jail Role ID', description: 'Configure jail role assigned to jailed users', value: 'jail_role_id' },
    { emoji: '🎮', label: 'GamePing Allowed Role', description: 'Configure role allowed to use ?gp', value: 'gameping_role_id' },
    { emoji: '⚙️', label: 'GamePing Min Permission', description: 'Configure min permission level to use ?gp', value: 'gameping_permission' },
  ].map(opt => ({
    ...opt,
    default: opt.value === activeSetting,
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId(`config:select:${executorId}`)
    .setPlaceholder('Select A Category From Menu')
    .addOptions(options);

  const clearBtn = new ButtonBuilder()
    .setCustomId(`config:clear:${executorId}`)
    .setLabel('Clear Config Overrides')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🗑️');

  const doneBtn = new ButtonBuilder()
    .setCustomId(`config:close:${executorId}`)
    .setLabel('Done')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');

  const components = [];
  components.push(new ActionRowBuilder().addComponents(select));

  // Add the dynamic selector depending on activeSetting
  if (activeSetting) {
    const settingNames = {
      suggestion_channel: 'Suggestions Channel',
      confession_channel: 'Confessions Channel',
      jail_role_id: 'Jail Role',
      log_channel: 'Unified Logs Channel',
      gameping_role_id: 'GamePing Allowed Role',
      gameping_permission: 'GamePing Permission Level',
    };
    const displayName = settingNames[activeSetting] || activeSetting;

    if (activeSetting === 'jail_role_id' || activeSetting === 'gameping_role_id') {
      const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId(`config:role_set:${activeSetting}:${executorId}`)
        .setPlaceholder(`Select role for ${displayName}...`);
      components.push(new ActionRowBuilder().addComponents(roleSelect));
    } else if (activeSetting === 'gameping_permission') {
      const permSelect = new StringSelectMenuBuilder()
        .setCustomId(`config:perm_set:${activeSetting}:${executorId}`)
        .setPlaceholder(`Select permission for ${displayName}...`)
        .addOptions([
          { emoji: emojis.general || '👥', label: 'Everyone', value: 'everyone', description: 'Allow anyone to run ?gp' },
          { emoji: emojis.moderation || '⚒️', label: 'Moderator', value: 'moderator', description: 'Allow moderators and above to run ?gp' },
          { emoji: emojis.admin || '⚙️', label: 'Admin', value: 'admin', description: 'Allow administrators only to run ?gp' },
        ]);
      components.push(new ActionRowBuilder().addComponents(permSelect));
    } else {
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`config:channel_set:${activeSetting}:${executorId}`)
        .setPlaceholder(`Select channel for ${displayName}...`)
        .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement]);
      components.push(new ActionRowBuilder().addComponents(channelSelect));
    }
  }

  components.push(new ActionRowBuilder().addComponents(clearBtn, doneBtn));

  return v2Payload(container, components);
}

export default {
  name: 'config',
  aliases: ['settings', 'cfg'],
  description: 'Manage bot configuration dashboard and overrides.',
  usage: '?config',
  permission: 'admin',

  async execute(message, args, client) {
    try {
      const executorId = message.author.id;
      const payload = renderDashboard(client, executorId);

      const reply = await message.reply({
        ...payload,
        allowedMentions: { repliedUser: false },
      });

      // Delete triggering message
      try {
        await message.delete();
      } catch {}


    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
