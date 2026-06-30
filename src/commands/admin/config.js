import { ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import { getDb } from '../../database/connection.js';
import { ConfigRepo } from '../../database/repositories/config.repo.js';
import { botConfig as config, getConfig } from '../../helpers/configHelper.js';
import { createV2Container, v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { CONFIG_SECTIONS } from '../../config/configSections.js';
import { handleCommandError } from '../../helpers/errorHandler.js';

const SECTION_ORDER = ['roles', 'notifications', 'suggestions', 'confessions', 'logging', 'voice', 'creator', 'jail', 'gameping', 'leveling', 'developer'];

function buildRefreshButton(executorId, sectionKey = null, activeSetting = null) {
  return new ButtonBuilder()
    .setCustomId(`config:refresh:${executorId}:${sectionKey || ''}:${activeSetting || ''}`)
    .setLabel('Refresh')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(emojis.loading);
}

function formatValue(settingKey, settingDef) {
  let rawValue;
  if (settingDef.configPath) {
    rawValue = getConfig(settingDef.configPath);
  } else {
    const db = getDb();
    rawValue = ConfigRepo.get(db, settingKey);
  }

  if (!rawValue) return '❌ *Not Set*';

  switch (settingDef.type) {
    case 'channel':
    case 'category':
      return `<#${rawValue}>`;
    case 'role':
      return `<@&${rawValue}>`;
    case 'roles': {
      const ids = typeof rawValue === 'string'
        ? rawValue.split(',').map(id => id.trim()).filter(Boolean)
        : (Array.isArray(rawValue) ? rawValue : []);
      if (!ids.length) return '❌ *Not Set*';
      return ids.map(id => `<@&${id}>`).join(' ');
    }
    case 'select': {
      const option = settingDef.options?.find(o => o.value === rawValue);
      return option ? `${option.emoji || ''} \`${rawValue}\`` : `\`${rawValue}\``;
    }
    default:
      return `\`${rawValue}\``;
  }
}

function buildHomeContent(client, overrides) {
  const lines = [
    `### ⚙️ ${config.branding.name} Configuration Dashboard`,
    `Manage bot configuration settings organized by section. Select a section below to view and edit its settings.`,
    '',
    `**Active Overrides:** ${Object.keys(overrides).length}`,
  ];

  return createV2Container({
    description: lines.join('\n'),
    color: config.colors.primary,
    client,
  });
}

function buildSectionContent(sectionKey, client, overrides) {
  const section = CONFIG_SECTIONS[sectionKey];
  if (!section) return buildHomeContent(client, overrides);

  const lines = [
    `### ⚙️ ${config.branding.name} — ${section.emoji} ${section.name}`,
    section.description,
    '',
  ];

  const settingEntries = Object.entries(section.settings);
  if (settingEntries.length === 0) {
    lines.push('*No settings available in this section yet.*');
  } else {
    for (const [settingKey, settingDef] of settingEntries) {
      const value = formatValue(settingKey, settingDef);
      lines.push(`**${settingDef.label}** ${value}`);
    }
  }

  return createV2Container({
    description: lines.join('\n'),
    color: config.colors.primary,
    client,
  });
}

function buildSectionDropdown(executorId, currentSection = null) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`config:nav:${executorId}`)
    .setPlaceholder(currentSection ? CONFIG_SECTIONS[currentSection]?.name || 'Select a section...' : 'Select a section...');

  for (const key of SECTION_ORDER) {
    const section = CONFIG_SECTIONS[key];
    if (!section) continue;
    menu.addOptions({
      label: section.name,
      value: key,
      emoji: section.emoji,
      description: section.description?.slice(0, 100),
      default: key === currentSection,
    });
  }

  return new ActionRowBuilder().addComponents(menu);
}

function buildHomeComponents(executorId) {
  const components = [];

  components.push(buildSectionDropdown(executorId));

  const refreshBtn = buildRefreshButton(executorId);

  const clearBtn = new ButtonBuilder()
    .setCustomId(`config:clear:${executorId}`)
    .setLabel('Clear Overrides')
    .setStyle(ButtonStyle.Danger)
    .setEmoji(emojis.delete);

  const doneBtn = new ButtonBuilder()
    .setCustomId(`config:close:${executorId}`)
    .setLabel('Done')
    .setStyle(ButtonStyle.Success)
    .setEmoji(emojis.success);

  components.push(new ActionRowBuilder().addComponents(refreshBtn, clearBtn, doneBtn));

  return components;
}

function buildSettingsDropdown(sectionKey, executorId, activeSetting = null) {
  const section = CONFIG_SECTIONS[sectionKey];
  if (!section) return null;

  const settingEntries = Object.entries(section.settings);
  if (!settingEntries.length) return null;

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`config:setting:${executorId}:${sectionKey}`)
    .setPlaceholder(activeSetting ? `${section.settings[activeSetting]?.label} (editing)` : 'Select a setting to edit...');

  for (const [settingKey, settingDef] of settingEntries) {
    menu.addOptions({
      label: settingDef.label,
      value: settingKey,
      description: (settingDef.description || '').slice(0, 100),
      default: settingKey === activeSetting,
    });
  }

  return new ActionRowBuilder().addComponents(menu);
}

function buildSectionComponents(sectionKey, executorId, overrides, activeSetting = null) {
  const section = CONFIG_SECTIONS[sectionKey];
  if (!section) return buildHomeComponents(executorId);

  const components = [];

  // Section dropdown navigation
  components.push(buildSectionDropdown(executorId, sectionKey));

  // Settings dropdown (replaces edit buttons)
  const settingsDropdown = buildSettingsDropdown(sectionKey, executorId, activeSetting);
  if (settingsDropdown) components.push(settingsDropdown);

  // Selector for the active setting
  if (activeSetting) {
    const settingDef = section.settings[activeSetting];
    if (settingDef) {
      const editId = `config:section_set:${executorId}:${sectionKey}:${activeSetting}`;
      const placeholder = `Select ${settingDef.label}...`;

      if (settingDef.type === 'role') {
        const select = new RoleSelectMenuBuilder()
          .setCustomId(editId)
          .setPlaceholder(placeholder);
        components.push(new ActionRowBuilder().addComponents(select));
      } else if (settingDef.type === 'roles') {
        const select = new RoleSelectMenuBuilder()
          .setCustomId(editId)
          .setPlaceholder(placeholder)
          .setMinValues(1)
          .setMaxValues(25);
        components.push(new ActionRowBuilder().addComponents(select));
      } else if (settingDef.type === 'channel') {
        const select = new ChannelSelectMenuBuilder()
          .setCustomId(editId)
          .setPlaceholder(placeholder)
          .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement]);
        components.push(new ActionRowBuilder().addComponents(select));
      } else if (settingDef.type === 'category') {
        const select = new ChannelSelectMenuBuilder()
          .setCustomId(editId)
          .setPlaceholder(placeholder)
          .setChannelTypes([ChannelType.GuildCategory]);
        components.push(new ActionRowBuilder().addComponents(select));
      } else if (settingDef.type === 'select' && settingDef.options) {
        const select = new StringSelectMenuBuilder()
          .setCustomId(editId)
          .setPlaceholder(placeholder)
          .addOptions(settingDef.options.map(opt => ({
            label: opt.label,
            value: opt.value,
            emoji: opt.emoji,
            description: opt.description,
          })));
        components.push(new ActionRowBuilder().addComponents(select));
      } else if (settingDef.type === 'string') {
        const editBtn = new ButtonBuilder()
          .setCustomId(`config:text_edit:${executorId}:${sectionKey}:${activeSetting}`)
          .setLabel(`Set ${settingDef.label}`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✏️');
        components.push(new ActionRowBuilder().addComponents(editBtn));
      }
    }
  }

  // Primary action buttons (bottom)
  const refreshBtn = buildRefreshButton(executorId, sectionKey, activeSetting);

  const clearBtn = new ButtonBuilder()
    .setCustomId(`config:clear:${executorId}`)
    .setLabel('Clear Overrides')
    .setStyle(ButtonStyle.Danger)
    .setEmoji(emojis.delete);

  const doneBtn = new ButtonBuilder()
    .setCustomId(`config:close:${executorId}`)
    .setLabel('Done')
    .setStyle(ButtonStyle.Success)
    .setEmoji(emojis.success);

  components.push(new ActionRowBuilder().addComponents(refreshBtn, clearBtn, doneBtn));

  // Jail management buttons (only in jail section)
  if (sectionKey === 'jail') {
    const createJailBtn = new ButtonBuilder()
      .setCustomId(`config:jail_create:${executorId}`)
      .setLabel('Create Jail Role')
      .setStyle(ButtonStyle.Primary)
      .setEmoji(emojis.jail);

    const deleteJailBtn = new ButtonBuilder()
      .setCustomId(`config:jail_delete:${executorId}`)
      .setLabel('Delete Jail Role')
      .setStyle(ButtonStyle.Danger)
      .setEmoji(emojis.delete);

    components.push(new ActionRowBuilder().addComponents(createJailBtn, deleteJailBtn));
  }

  return components;
}

export function renderDashboard(client, executorId = '', sectionKey = null, activeSetting = null) {
  const db = getDb();
  const overrides = ConfigRepo.getAll(db);

  const isHome = !sectionKey || !CONFIG_SECTIONS[sectionKey];

  const container = isHome
    ? buildHomeContent(client, overrides)
    : buildSectionContent(sectionKey, client, overrides);

  const components = isHome
    ? buildHomeComponents(executorId)
    : buildSectionComponents(sectionKey, executorId, overrides, activeSetting);

  return v2Payload(container, components);
}

function handleArgs(args) {
  if (args.length === 0) return null;
  const input = args[0].toLowerCase();
  for (const key of SECTION_ORDER) {
    const section = CONFIG_SECTIONS[key];
    if (!section) continue;
    if (key === input || section.name.toLowerCase() === input) {
      return key;
    }
  }
  return null;
}

export default {
  name: 'config',
  aliases: ['settings', 'cfg'],
  description: 'Manage bot configuration dashboard and overrides.',
  usage: '?config [section]',
  permission: 'admin',

  async execute(message, args, client) {
    try {
      const executorId = message.author.id;
      const sectionKey = handleArgs(args);
      const payload = renderDashboard(client, executorId, sectionKey);

      const reply = await message.reply({
        ...payload,
        allowedMentions: { repliedUser: false },
      });

      try {
        await message.delete();
      } catch {}
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
