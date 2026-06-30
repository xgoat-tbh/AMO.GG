import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createV2Container, v2Payload, v2EditPayload, codeStat, notification } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { jailManager } from '../../systems/jail/jailManager.js';
import { emojis } from '../../config/emojis.config.js';

export default {
  customId: 'jail:refresh',

  async execute(interaction, client) {
    const stats = jailManager.getStats();
    const active = jailManager.getActiveAll();
    const due = jailManager.getDueForRelease();

    const lines = [
      `### ⛓️ Jail Dashboard`,
      '',
      codeStat('Currently Jailed', stats.active),
      codeStat('Total Cases', stats.total),
      codeStat('Jailed Today', stats.today),
      codeStat('Released Today', stats.released),
      due.length > 0 ? codeStat('Due for Release', due.length) : '',
      '',
      active.length > 0 ? '**Current Population:**' : '*No one is jailed.*',
    ].filter(Boolean).join('\n');

    const popLines = active.slice(0, 10).map((r, i) => {
      const remaining = r.duration ? formatDuration(r.duration - (Math.floor(Date.now() / 1000) - r.jailed_at)) : 'Permanent';
      return `${i + 1}. <@${r.user_id}> — ${remaining}`;
    });

    const fullLines = [lines, '', ...popLines].join('\n');

    const container = createV2Container({
      description: fullLines,
      color: config.colors.jail,
      client,
    });

    let components = [];
    if (active.length > 0) {
      const refreshBtn = new ButtonBuilder()
        .setCustomId(`jail:refresh:${interaction.user.id}`)
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.loading);
      components.push(new ActionRowBuilder().addComponents(refreshBtn));
    }

    await interaction.update(v2EditPayload(container, components));
  },
};

function formatDuration(seconds) {
  if (!seconds) return 'Permanent';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}
