import { ActivityType } from 'discord.js';
import { config } from '../config/bot.config.js';
import { logger } from '../helpers/logger.js';
import { startGiveawayTicker } from '../systems/giveaways/giveawayManager.js';

export default {
  name: 'clientReady',
  once: true,
  async execute(client) {
    try {
      logger.success('BOT', `${config.branding.name} is online as ${client.user.tag}`);
      const guild = config.guildId ? await client.guilds.fetch(config.guildId).catch(() => null) : null;
      const memberCount = guild?.memberCount ?? client.guilds.cache.get(config.guildId)?.memberCount ?? 0;

      client.user.setActivity(`${memberCount} members in Amo India`, {
        type: ActivityType.Watching,
      });

      // Start background giveaway rolling scheduler ticker
      startGiveawayTicker(client);
    } catch (error) {
      logger.error('BOT', `Error during startup clientReady: ${error.message}`, error);
    }
  },
};

