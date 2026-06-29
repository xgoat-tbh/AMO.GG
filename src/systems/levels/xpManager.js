import { getDb } from '../../database/connection.js';
import { XpRepo, xpForLevel, levelFromXp } from '../../database/repositories/xp.repo.js';
import { logger } from '../../helpers/logger.js';

// In-memory cooldown tracking for anti-farming
const messageCooldowns = new Map();
const voiceTimers = new Map();

export const xpManager = {
  async handleMessage(userId, guildId) {
    const db = getDb();
    const config = XpRepo.getConfig(db, guildId);
    if (!config.enabled) return;

    const now = Date.now();
    const lastMsg = messageCooldowns.get(`${userId}:${guildId}`) || 0;
    if (now - lastMsg < config.message_cooldown * 1000) return;
    messageCooldowns.set(`${userId}:${guildId}`, now);

    const min = config.xp_min || 15;
    const max = config.xp_max || 25;
    const amount = Math.floor(Math.random() * (max - min + 1)) + min;
    const multiplied = Math.floor(amount * (config.rate || 1));

    const row = XpRepo.addXp(db, userId, guildId, multiplied);
    await this.checkLevelUp(db, userId, guildId, row, config);
  },

  async handleVoiceState(userId, guildId, inVoice) {
    if (inVoice) {
      if (!voiceTimers.has(`${userId}:${guildId}`)) {
        voiceTimers.set(`${userId}:${guildId}`, Date.now());
      }
    } else {
      const start = voiceTimers.get(`${userId}:${guildId}`);
      if (start) {
        voiceTimers.delete(`${userId}:${guildId}`);
        const elapsed = Math.floor((Date.now() - start) / 1000);
        if (elapsed >= 60) {
          const db = getDb();
          const config = XpRepo.getConfig(db, guildId);
          if (config.enabled) {
            const xpGain = Math.floor((elapsed / 60) * (config.xp_min || 15) * (config.rate || 1));
            XpRepo.addVoiceXp(db, userId, guildId, xpGain);
            XpRepo.addXp(db, userId, guildId, xpGain);
          }
        }
      }
    }
  },

  async checkLevelUp(db, userId, guildId, row, config) {
    if (!row) return { leveledUp: false };
    const currentLevel = row.level;
    const calculatedLevel = levelFromXp(row.xp);

    if (calculatedLevel > currentLevel) {
      XpRepo.setLevel(db, userId, guildId, calculatedLevel);

      // Check for role rewards
      const rewards = XpRepo.getRewards(db, guildId);
      const earned = rewards.filter(r => r.level <= calculatedLevel && r.level > currentLevel);

      return { leveledUp: true, oldLevel: currentLevel, newLevel: calculatedLevel, rewards: earned };
    }
    return { leveledUp: false };
  },

  getRankCard(userId, guildId) {
    const db = getDb();
    const data = XpRepo.ensure(db, userId, guildId);
    const rank = XpRepo.getRank(db, userId, guildId);
    const totalXp = data.xp;
    const level = data.level;
    const nextLevelXp = xpForLevel(level + 1);
    const currentLevelXp = xpForLevel(level);
    const progress = totalXp - currentLevelXp;
    const needed = nextLevelXp - currentLevelXp;
    const percent = needed > 0 ? Math.min(100, Math.floor((progress / needed) * 100)) : 0;

    return { data, rank, totalXp, level, nextLevelXp, currentLevelXp, progress, needed, percent };
  },

  getLeaderboard(guildId, limit = 10) {
    const db = getDb();
    return XpRepo.getLeaderboard(db, guildId, limit);
  },

  getGlobalRank(userId) {
    const db = getDb();
    const row = db.prepare('SELECT SUM(xp) as total_xp, SUM(voice_xp) as total_voice FROM xp WHERE user_id = ?').get(userId);
    return row || { total_xp: 0, total_voice: 0 };
  },
};
