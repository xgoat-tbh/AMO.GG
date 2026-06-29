import { createV2Container, v2Payload, codeStat, relativeTime } from '../helpers/v2Helper.js';
import { config } from '../config/bot.config.js';
import { emojis } from '../config/emojis.config.js';
import { handleCommandError } from '../helpers/errorHandler.js';
import { xpManager } from '../systems/levels/xpManager.js';
import { XpRepo } from '../database/repositories/xp.repo.js';
import { getDb } from '../database/connection.js';

function renderProgressBar(percent, length = 12) {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return '▰'.repeat(filled) + '▱'.repeat(empty);
}

export default {
  name: 'rank',
  aliases: ['level', 'xp', 'profile'],
  description: 'View your rank and XP progress.',
  usage: '?rank [@user]',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      const target = message.mentions.users.first() || message.author;
      const member = message.guild.members.cache.get(target.id);

      const card = xpManager.getRankCard(target.id, message.guild.id);
      const rewards = XpRepo.getRewards(getDb(), message.guild.id);
      const nextReward = rewards.find(r => r.level > card.level);

      const lines = [
        `### ${emojis.general} ${member?.displayName || target.username}'s Rank`,
        '',
        `**Level** ${card.level}`,
        `**XP** ${card.totalXp.toLocaleString()} / ${card.nextLevelXp.toLocaleString()}`,
        `**Rank** #${card.rank}`,
        '',
        `${renderProgressBar(card.percent)} ${card.percent}%`,
        '',
        codeStat('Messages', (card.totalXp - (card.data.voice_xp || 0)).toLocaleString()),
        codeStat('Voice', `${(card.data.voice_xp || 0).toLocaleString()} XP`),
        codeStat('Total XP', card.totalXp.toLocaleString()),
      ];

      if (nextReward) {
        lines.push('', `**Next Reward** Level ${nextReward.level}${nextReward.description ? ` — ${nextReward.description}` : ''}`);
      }

      const container = createV2Container({
        description: lines.join('\n'),
        color: config.colors.primary,
        thumbnail: target.displayAvatarURL({ size: 128 }),
        client,
      });

      await message.reply({
        ...v2Payload(container),
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await handleCommandError(message, error);
    }
  },
};
