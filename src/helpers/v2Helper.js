import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config/bot.config.js';
import { emojis } from '../config/emojis.config.js';

// ── Core Container ──────────────────────────────────────────────

export function createV2Container({
  title,
  description,
  color,
  fields,
  thumbnail,
  author,
  footer,
  client,
} = {}) {
  const parts = [];
  if (title) parts.push(`### ${title}`);
  if (author?.name) parts.push(`*— ${author.name}*`);
  if (description) parts.push(description);

  if (fields && fields.length) {
    const fieldParts = fields.map(f => {
      const val = String(f.value);
      return val.includes('\n') ? `**${f.name}**\n${val}` : `**${f.name}** ${val}`;
    });
    parts.push(fieldParts.join('\n'));
  }

  if (footer) parts.push(`*${footer}*`);

  const textContent = parts.join('\n\n');
  const finalColor = color ?? config.colors.primary;

  const container = new ContainerBuilder();

  if (thumbnail) {
    const imgUrl = thumbnail.url || thumbnail;
    const section = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent || ' '))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(imgUrl));
    container.addSectionComponents(section);
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent || ' '));
  }

  container.setAccentColor(finalColor);
  return container;
}

// ── Payload helpers ───────────────────────────────────────────────

export function v2Payload(target, extraComponents = [], ephemeral = false, isEdit = false) {
  if (target instanceof ContainerBuilder && extraComponents?.length) {
    for (const comp of extraComponents) {
      if (comp instanceof ActionRowBuilder || comp?.type === 1) {
        target.addActionRowComponents(comp);
      }
    }
  }

  const payload = { components: [target] };
  if (!isEdit) {
    const flags = [MessageFlags.IsComponentsV2];
    if (ephemeral) flags.push(MessageFlags.Ephemeral);
    payload.flags = flags;
  }
  return payload;
}

export function v2EditPayload(target, extraComponents = []) {
  return v2Payload(target, extraComponents, false, true);
}

export function v2Ephemeral(target, extraComponents = []) {
  return v2Payload(target, extraComponents, true);
}

// ── Notification Cards (compact) ────────────────────────────────

const notifyColors = {
  success: config.colors.success,
  error: config.colors.error,
  warning: config.colors.warning,
  info: config.colors.info,
};

export function notification(type, lines, client) {
  const color = notifyColors[type] || config.colors.primary;
  const content = (Array.isArray(lines) ? lines : [lines]).join('\n');
  return createV2Container({ description: content, color, client });
}

export function notifySuccess(lines, client) { return notification('success', lines, client); }
export function notifyError(lines, client) { return notification('error', lines, client); }
export function notifyWarning(lines, client) { return notification('warning', lines, client); }
export function notifyInfo(lines, client) { return notification('info', lines, client); }

// ── Result containers (legacy compat) ────────────────────────────

export function createV2Success(description, client) {
  return createV2Container({ description, color: config.colors.success, client });
}

export function createV2Error(description, client) {
  return createV2Container({ description, color: config.colors.error, client });
}

export function createV2Warning(description, client) {
  return createV2Container({ description, color: config.colors.warning, client });
}

// ── Text formatting helpers ──────────────────────────────────────

export function stat(label, value, icon) {
  return `${icon ? `${icon} ` : ''}**${label}** ${value}`;
}

export function codeStat(label, value) {
  return `• **${label}** \`${value}\``;
}

export function field(label, value) {
  return `• **${label}**: ${value}`;
}

export function relativeTime(epochSeconds) {
  return `<t:${Math.floor(epochSeconds)}:R>`;
}

// ── Status Indicator ─────────────────────────────────────────────

export function statusDot(value, thresholds) {
  if (value <= (thresholds?.good ?? 50)) return '✅';
  if (value <= (thresholds?.fair ?? 150)) return '⚠️';
  if (value <= (thresholds?.poor ?? 300)) return '🟠';
  return '❌';
}

export function statusLabel(value, thresholds) {
  if (value <= (thresholds?.good ?? 50)) return 'Excellent';
  if (value <= (thresholds?.fair ?? 150)) return 'Good';
  if (value <= (thresholds?.poor ?? 300)) return 'Fair';
  return 'Poor';
}

// ── Pagination Builder ───────────────────────────────────────────

export function paginationRow(customIdPrefix, page, totalPages, executorId, extra = {}) {
  const base = `${customIdPrefix}:${executorId}`;
  const prev = new ButtonBuilder()
    .setCustomId(`${base}:prev:${page}:${totalPages}:${JSON.stringify(extra)}`)
    .setLabel('◀')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 1);

  const indicator = new ButtonBuilder()
    .setCustomId(`${base}:indicator`)
    .setLabel(`Page ${page}/${totalPages}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const next = new ButtonBuilder()
    .setCustomId(`${base}:next:${page}:${totalPages}:${JSON.stringify(extra)}`)
    .setLabel('▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages);

  return new ActionRowBuilder().addComponents(prev, indicator, next);
}

// ── Permission Badge ─────────────────────────────────────────────

export function permissionBadge(level) {
  const badges = {
    owner: '🏆 Owner',
    admin: '🛡️ Admin',
    moderator: '⚔️ Moderator',
    everyone: '👤 Everyone',
    dev: '🔧 Developer',
  };
  return badges[level] || `👤 ${level}`;
}

// ── Command Pill ─────────────────────────────────────────────────

export function commandPill(name) {
  return `\`${name}\``;
}

export function commandPills(names) {
  return names.map(n => commandPill(n)).join(' ');
}

// ── Help Navigation Builder ──────────────────────────────────────

export function helpNavRow(view, executorId, opts = {}) {
  const { currentCategory, currentPage, totalPages, cmdCount, sortOrder } = opts;
  const base = `help:nav:${executorId}`;

  // Home button always present
  const home = new ButtonBuilder()
    .setCustomId(`${base}:home`)
    .setEmoji('🏠')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(view === 'home');

  const row = new ActionRowBuilder().addComponents(home);

  if (view === 'category' && currentCategory) {
    const prevCat = new ButtonBuilder()
      .setCustomId(`${base}:prev_cat:${currentCategory}:${currentPage || 1}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!opts.hasPrevCategory);

    const nextCat = new ButtonBuilder()
      .setCustomId(`${base}:next_cat:${currentCategory}:${currentPage || 1}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!opts.hasNextCategory);

    const cmdCountBtn = new ButtonBuilder()
      .setCustomId(`${base}:cmd_count`)
      .setLabel(`${cmdCount || 0} cmds`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    row.addComponents(prevCat, cmdCountBtn, nextCat);
  }

  if (view === 'all') {
    const prev = new ButtonBuilder()
      .setCustomId(`${base}:all:${(currentPage || 1) - 1}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!currentPage || currentPage <= 1);

    const indicator = new ButtonBuilder()
      .setCustomId(`${base}:page_indicator`)
      .setLabel(`Page ${currentPage || 1}/${totalPages || 1}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const next = new ButtonBuilder()
      .setCustomId(`${base}:all:${(currentPage || 1) + 1}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!totalPages || currentPage >= totalPages);

    row.addComponents(prev, indicator, next);
  }

  return row;
}

// ── Category Dropdown ────────────────────────────────────────────

const CATEGORY_ORDER = ['utility', 'voice', 'roles', 'suggestions', 'confessions', 'gameping', 'admin', 'creator'];
const CATEGORY_META = {
  utility: { emoji: emojis.general, name: 'General' },
  voice: { emoji: emojis.voice, name: 'Voice' },
  roles: { emoji: emojis.roles, name: 'Roles' },
  suggestions: { emoji: emojis.suggestion, name: 'Suggestions' },
  confessions: { emoji: emojis.confession, name: 'Confessions' },
  gameping: { emoji: emojis.game, name: 'GamePing' },
  admin: { emoji: emojis.admin, name: 'Administration' },
  creator: { emoji: emojis.creator, name: 'Creator' },
};

export const CATEGORY_NAMES = Object.fromEntries(
  Object.entries(CATEGORY_META).map(([k, v]) => [k, v.name])
);

export const CATEGORY_DESCRIPTIONS = {
  utility: 'General and utility tools for everyone.',
  voice: 'Voice channel management and configuration.',
  roles: 'Configure and assign roles in the guild.',
  suggestions: 'Submit and vote on community suggestions.',
  confessions: 'Send anonymous or known confessions.',
  gameping: 'Configure and ping game roles easily.',
  admin: 'Manage bot settings and server configuration.',
  creator: 'Workspace management and tools for creators.',
};

export function categoryDropdown(executorId, currentCategory = null) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`help:category:${executorId}`)
    .setPlaceholder('Browse a category...');

  for (const key of CATEGORY_ORDER) {
    const meta = CATEGORY_META[key];
    menu.addOptions({
      label: meta.name,
      value: key,
      emoji: meta.emoji,
      default: key === currentCategory,
    });
  }

  return new ActionRowBuilder().addComponents(menu);
}

export function getCategoryMeta(key) {
  return CATEGORY_META[key] || { emoji: '📁', name: key };
}

export { CATEGORY_ORDER };

// ── Search Builder ───────────────────────────────────────────────

export function searchDropdown(executorId, query, results) {
  if (!results || results.length === 0) return null;

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`help:search:${executorId}:${query}`)
    .setPlaceholder(`Results for "${query}"...`);

  for (const cmd of results.slice(0, 25)) {
    menu.addOptions({
      label: cmd.name,
      value: cmd.name,
      description: cmd.description ? cmd.description.slice(0, 50) : 'No description',
    });
  }

  return new ActionRowBuilder().addComponents(menu);
}