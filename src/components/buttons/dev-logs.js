import { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createV2Container, v2Payload, v2EditPayload } from '../../helpers/v2Helper.js';
import { emojis } from '../../config/emojis.config.js';
import { config } from '../../config/bot.config.js';
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  customId: 'dev:logs',

  async execute(interaction, client) {
    const parts = interaction.customId.split(':');
    const action = parts[2]; // 'prev' or 'next'
    const page = parseInt(parts[3], 10) || 1;
    const executorId = parts[4];

    if (executorId && interaction.user.id !== executorId) {
      await interaction.reply({
        content: `${emojis.error} Only the developer who ran ?dev logs can use these buttons.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let newPage = page;
    if (action === 'prev') {
      newPage = Math.max(1, page - 1);
    } else if (action === 'next') {
      newPage = page + 1;
    }

    const logPath = join(__dirname, '..', '..', '..', 'logs', 'combined.log');
    if (!fs.existsSync(logPath)) {
      await interaction.update(v2EditPayload(createV2Container({
        title: '📋 Bot logs',
        description: `${emojis.error} No logs found in \`logs/combined.log\`.`,
        color: config.colors.error,
        client,
      }), []));
      return;
    }

    const allLines = fs.readFileSync(logPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .reverse(); // Latest logs first

    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(allLines.length / pageSize));
    const targetPage = Math.min(newPage, totalPages);

    const startIndex = (targetPage - 1) * pageSize;
    const pageLines = allLines.slice(startIndex, startIndex + pageSize);

    // Color code and format logs
    const formattedLogs = pageLines.map(line => {
      if (line.includes('[ERROR]')) return ` [31m${line} [0m`;
      if (line.includes('[WARN]')) return ` [33m${line} [0m`;
      if (line.includes('[SUCCESS]')) return ` [32m${line} [0m`;
      return line;
    }).reverse().join('\n'); // Keep chronological order on page

    const logContent = formattedLogs ? `\`\`\`ansi\n${formattedLogs}\n\`\`\`` : '*No log entries.*';

    const container = createV2Container({
      title: `📋 System Logs (Page ${targetPage}/${totalPages})`,
      description: logContent,
      color: config.colors.primary,
      client,
    });

    const prevBtn = new ButtonBuilder()
      .setCustomId(`dev:logs:prev:${targetPage}:${interaction.user.id}`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(targetPage === 1);

    const nextBtn = new ButtonBuilder()
      .setCustomId(`dev:logs:next:${targetPage}:${interaction.user.id}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(targetPage === totalPages);

    const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

    await interaction.update(v2EditPayload(container, [row]));
  },
};
