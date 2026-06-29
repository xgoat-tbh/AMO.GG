import { 
  ContainerBuilder, 
  SectionBuilder, 
  TextDisplayBuilder, 
  ThumbnailBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  MessageFlags 
} from 'discord.js';
import { config } from '../../config/bot.config.js';
import { assets } from '../../config/assets.config.js';
import { v2Payload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';

// In-memory drafts keyed by userId
const activeDrafts = new Map();

/**
 * Retrieves the user's active draft, or initializes a default one.
 */
export function getDraft(userId) {
  if (!activeDrafts.has(userId)) {
    activeDrafts.set(userId, {
      title: 'Draft Title',
      description: 'Draft Description',
      color: '#5865F2',
      thumbnail: null,
      channelId: null,
      lastActive: Date.now(),
    });
  } else {
    activeDrafts.get(userId).lastActive = Date.now();
  }
  return activeDrafts.get(userId);
}

/**
 * Saves/updates a user's draft.
 */
export function saveDraft(userId, data) {
  const current = getDraft(userId);
  const updated = { ...current, ...data, lastActive: Date.now() };
  activeDrafts.set(userId, updated);
}

/**
 * Deletes a user's draft.
 */
export function deleteDraft(userId) {
  activeDrafts.delete(userId);
}

/**
 * Converts a hex string (e.g. #FF0000 or FF0000) to a numeric color.
 */
export function parseHexColor(hexStr) {
  if (!hexStr) return config.colors.primary;
  let clean = hexStr.replace('#', '').trim();
  const num = parseInt(clean, 16);
  return isNaN(num) ? config.colors.primary : num;
}

/**
 * Generates the V2 card preview payload representing the current draft.
 */
export function buildBuilderPayload(client, userId) {
  const draft = getDraft(userId);

  const channelText = draft.channelId ? `<#${draft.channelId}>` : '*None selected (posts in current channel)*';

  const lines = [
    `### 🎨 Live Embed Preview`,
    `**Title**: ${draft.title || '*None*'}`,
    `**Description**: ${draft.description || '*None*'}`,
    `**Color**: \`${draft.color}\``,
    `**Thumbnail**: ${draft.thumbnail ? `\`${draft.thumbnail}\`` : '*None*'}`,
    `**Target Channel**: ${channelText}`,
    `\n*Use the buttons below to customize the fields. Click Publish when ready!*`,
  ];

  const previewSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n'))
    );

  if (draft.thumbnail) {
    previewSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(draft.thumbnail));
  } else {
    previewSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(assets.help));
  }

  const container = new ContainerBuilder()
    .addSectionComponents(previewSection)
    .setAccentColor(parseHexColor(draft.color));

  const titleBtn = new ButtonBuilder()
    .setCustomId('embed:edit:title')
    .setLabel('✏️ Title')
    .setStyle(ButtonStyle.Secondary);

  const descBtn = new ButtonBuilder()
    .setCustomId('embed:edit:description')
    .setLabel(`${emojis.confession} Description`)
    .setStyle(ButtonStyle.Secondary);

  const colorBtn = new ButtonBuilder()
    .setCustomId('embed:edit:color')
    .setLabel('🎨 Color')
    .setStyle(ButtonStyle.Secondary);

  const thumbBtn = new ButtonBuilder()
    .setCustomId('embed:edit:thumbnail')
    .setLabel('🖼️ Thumbnail')
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder().addComponents(titleBtn, descBtn, colorBtn, thumbBtn);

  const chanBtn = new ButtonBuilder()
    .setCustomId('embed:edit:channel')
    .setLabel('🌐 Target Channel')
    .setStyle(ButtonStyle.Secondary);

  const publishBtn = new ButtonBuilder()
    .setCustomId('embed:publish')
    .setLabel('🚀 Publish')
    .setStyle(ButtonStyle.Success);

  const cancelBtn = new ButtonBuilder()
    .setCustomId('embed:cancel')
    .setLabel(`${emojis.error} Cancel`)
    .setStyle(ButtonStyle.Danger);

  const row2 = new ActionRowBuilder().addComponents(chanBtn, publishBtn, cancelBtn);

  return v2Payload(container, [row1, row2]);
}

/**
 * Builds the final published V2 Container without control buttons.
 */
export function buildPublishedContainer(client, draft) {
  const lines = [];
  if (draft.title) lines.push(`### ${draft.title}`);
  if (draft.description) lines.push(draft.description);

  const section = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n') || ' ')
    );

  if (draft.thumbnail) {
    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(draft.thumbnail));
  } else {
    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL()));
  }

  const container = new ContainerBuilder()
    .addSectionComponents(section)
    .setAccentColor(parseHexColor(draft.color));

  return container;
}

// Sweep inactive drafts (older than 30 mins) every 5 minutes to prevent leak
setInterval(() => {
  const now = Date.now();
  for (const [userId, draft] of activeDrafts.entries()) {
    if (now - draft.lastActive > 30 * 60 * 1000) {
      activeDrafts.delete(userId);
    }
  }
}, 5 * 60 * 1000);
