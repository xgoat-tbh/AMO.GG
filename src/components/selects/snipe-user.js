import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { getChannelSnipes } from '../../systems/snipe/snipeManager.js';
import { createV2Container, v2EditPayload } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { emojis } from '../../config/emojis.config.js';

const MESSAGES_PER_PAGE = 5;

export default {
  customId: 'snipe:user',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const executorId = parts[2];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the person who ran the snipe command can use this menu.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const userId = interaction.values[0];
    const snipes = getChannelSnipes(interaction.channel.id);
    const userMessages = snipes.filter(m => m.author.id === userId);

    if (!userMessages.length) {
      await interaction.reply({
        content: `${emojis.error} No deleted messages found for this user.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();

    const payload = buildMessagesPage(userMessages, interaction.user.id, 1, client);
    await interaction.editReply(payload);
  },
};

export function buildMessagesPage(messages, executorId, page, client) {
  const totalPages = Math.ceil(messages.length / MESSAGES_PER_PAGE);
  const startIdx = (page - 1) * MESSAGES_PER_PAGE;
  const pageMessages = messages.slice(startIdx, startIdx + MESSAGES_PER_PAGE);

  const author = pageMessages[0]?.author;
  const displayName = author?.displayName || 'Unknown';

  const lines = [`### 🎯 Snipe — ${displayName}`, ''];

  let i = 0;
  for (const msg of pageMessages) {
    const globalIdx = startIdx + i + 1;
    i++;
    lines.push(`**#${globalIdx}** — <t:${msg.timestamp}:R>`);
    if (msg.content) {
      lines.push(`> ${msg.content}`);
    } else {
      lines.push('> *No text content*');
    }
    if (msg.attachments.length > 0) {
      lines.push(`📎 ${msg.attachments.map((url, idx) => `[Attachment ${idx + 1}](${url})`).join(' · ')}`);
    }
    lines.push('');
  }

  if (totalPages > 1) {
    lines.push(`*Page ${page}/${totalPages}*`);
  }

  const container = createV2Container({
    description: lines.join('\n'),
    color: config.colors.primary,
    thumbnail: author?.avatar,
    client,
  });

  const buttons = [];

  const backButton = new ButtonBuilder()
    .setCustomId(`snipe:back:${executorId}`)
    .setLabel('Back to users')
    .setStyle(ButtonStyle.Secondary);
  buttons.push(backButton);

  if (totalPages > 1) {
    const prevButton = new ButtonBuilder()
      .setCustomId(`snipe:page:${executorId}:${author.id}:${page}:prev`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1);

    const pageIndicator = new ButtonBuilder()
      .setCustomId(`snipe:page_indicator:${executorId}:${author.id}:${page}`)
      .setLabel(`${page}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const nextButton = new ButtonBuilder()
      .setCustomId(`snipe:page:${executorId}:${author.id}:${page}:next`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages);

    buttons.push(prevButton, pageIndicator, nextButton);
  }

  const actionRow = new ActionRowBuilder().addComponents(buttons);

  return v2EditPayload(container, [actionRow]);
}
