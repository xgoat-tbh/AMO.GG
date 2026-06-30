import { getDb } from '../../database/connection.js';
import { BumpRepo } from '../../database/repositories/bump.repo.js';
import { createV2Container, v2Payload, notification } from '../../helpers/v2Helper.js';
import { config } from '../../config/bot.config.js';
import { logger } from '../../helpers/logger.js';

const BUMP_COOLDOWN = 7200;
const REMINDER_INTERVAL = 60000;

let bumpTicker = null;

let lastCheckCache = {};

export const bumpManager = {
  startTicker(client) {
    if (bumpTicker) clearInterval(bumpTicker);
    bumpTicker = setInterval(() => this.checkAndRemind(client), REMINDER_INTERVAL);
    logger.info('BUMP', 'Bump reminder ticker started');
  },

  stopTicker() {
    if (bumpTicker) {
      clearInterval(bumpTicker);
      bumpTicker = null;
    }
  },

  getConfig(guildId) {
    const db = getDb();
    return BumpRepo.getConfig(db, guildId);
  },

  setConfig(guildId, channelId, roleId = null) {
    const db = getDb();
    BumpRepo.setConfig(db, guildId, channelId, roleId);
  },

  recordBump(guildId) {
    const db = getDb();
    BumpRepo.updateLastBump(db, guildId);
  },

  async checkAndRemind(client) {
    const db = getDb();
    const configs = BumpRepo.getAllEnabled(db);

    for (const cfg of configs) {
      const guild = client.guilds.cache.get(cfg.guild_id);
      if (!guild) continue;

      const channel = guild.channels.cache.get(cfg.channel_id);
      if (!channel) continue;

      const now = Math.floor(Date.now() / 1000);
      const lastBump = cfg.last_bump_time || 0;
      const sinceLastBump = now - lastBump;

      if (sinceLastBump >= BUMP_COOLDOWN) {
        const cacheKey = `${cfg.guild_id}:${lastBump}`;
        if (lastCheckCache[cacheKey]) continue;
        lastCheckCache[cacheKey] = true;

        const roleMention = cfg.role_id ? `<@&${cfg.role_id}>` : '@everyone';
        const lines = [
          `### ⬆️ Time to Bump!`,
          `It's been over 2 hours since the last bump.`,
          '',
          `${roleMention} use \`/bump\` on **DISBOARD** to keep the server growing!`,
          '',
          `-# Bump in <#${cfg.channel_id}> to keep the server discoverable.`,
        ];

        const container = createV2Container({ description: lines.join('\n'), color: config.colors.primary, client });

        try {
          await channel.send({ ...v2Payload(container), allowedMentions: { roles: cfg.role_id ? [cfg.role_id] : [] } });
          logger.info('BUMP', `Sent bump reminder in ${guild.name}#${channel.name}`);
        } catch (err) {
          logger.error('BUMP', `Failed to send bump reminder: ${err.message}`);
        }
      }
    }

    if (Object.keys(lastCheckCache).length > 100) {
      lastCheckCache = {};
    }
  },

  removeConfig(guildId) {
    const db = getDb();
    BumpRepo.removeConfig(db, guildId);
  },
};
