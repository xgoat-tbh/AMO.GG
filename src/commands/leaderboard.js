import { createV2Container, v2Payload } from '../helpers/v2Helper.js';
import { config } from '../config/bot.config.js';
import { handleCommandError } from '../helpers/errorHandler.js';
import { xpManager } from '../systems/levels/xpManager.js';

const MEDALS = [`🏆`, '🥈', '🥉'];

export default {
  name: 'leaderboard',
  aliases: ['lb', 'top'],
  description: 'View the server XP leaderboard.',
  usage: '?leaderboard',
  permission: 'everyone',

  async execute(message, args, client) {
    try {
      const top = xpManager.getLeaderboard(message.guild.id, 20);

      if (top.length === 0) {
        const container = createV2Container({
          description: `ℹ️ No XP data yet. Start chatting to earn XP!`,
          color: config.colors.primary,
          client,
        });
        return message.reply({ ...v2Payload(container), allowedMentions: { repliedUser: false } });
      }

      const lines = [`### 🏆 XP Leaderboard`];

      for (let i = 0; i < top.length; i++) {
        const entry = top[i];
        const rank = i < 3 ? MEDALS[i] : `\`#${i + 1}\``;
        const name = client.users.cache.get(entry.user_id)?.username || entry.user_id.slice(0, 8);
        lines.push(`${rank} **${name}** — Level ${entry.level} (${entry.xp.toLocaleString()} XP)`);
      }

      const container = createV2Container({
        description: lines.join('\n'),
        color: config.colors.primary,
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
