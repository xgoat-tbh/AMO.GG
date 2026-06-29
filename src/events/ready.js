import { ActivityType } from 'discord.js';
import { config } from '../config/bot.config.js';
import { logger } from '../helpers/logger.js';
import { startGiveawayTicker } from '../systems/giveaways/giveawayManager.js';
import { jailManager } from '../systems/jail/jailManager.js';

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

      // Start jail auto-release ticker (every 30 seconds)
      setInterval(async () => {
        try {
          const due = jailManager.getDueForRelease();
          for (const record of due) {
            const guild = client.guilds.cache.get(config.guildId);
            if (!guild) continue;
            const member = await guild.members.fetch(record.user_id).catch(() => null);
            if (member) {
              await jailManager.unjail(member, client.user);
              logger.info('JAIL', `Auto-released ${record.user_id} (duration expired)`);
              try {
                await member.send(`You have been automatically released from jail in ${guild.name}.`).catch(() => null);
              } catch {}
            } else {
              // User left the server — mark as released
              const { getDb } = await import('../database/connection.js');
              const { JailRepo } = await import('../database/repositories/jail.repo.js');
              JailRepo.unjail(getDb(), record.id, 'system');
            }
          }
        } catch {}
      }, 30000);
    } catch (error) {
      logger.error('BOT', `Error during startup clientReady: ${error.message}`, error);
    }
  },
};
