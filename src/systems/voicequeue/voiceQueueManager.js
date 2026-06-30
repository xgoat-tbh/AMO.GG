import { getDb } from '../../database/connection.js';
import { QueueRepo } from '../../database/repositories/queue.repo.js';
import { logger } from '../../helpers/logger.js';

const CLEANUP_INTERVAL = 300000;

let cleanupTicker = null;

export const voiceQueueManager = {
  startCleanupTicker() {
    if (cleanupTicker) clearInterval(cleanupTicker);
    cleanupTicker = setInterval(() => {
      const db = getDb();
      QueueRepo.pruneStale(db, 120);
    }, CLEANUP_INTERVAL);
    logger.info('VCQUEUE', 'Voice queue cleanup ticker started');
  },

  stopCleanupTicker() {
    if (cleanupTicker) {
      clearInterval(cleanupTicker);
      cleanupTicker = null;
    }
  },

  joinQueue(guildId, targetChannelId, userId) {
    const db = getDb();
    return QueueRepo.join(db, guildId, targetChannelId, userId);
  },

  leaveQueue(guildId, targetChannelId, userId) {
    const db = getDb();
    return QueueRepo.leave(db, guildId, targetChannelId, userId);
  },

  getQueue(targetChannelId) {
    const db = getDb();
    return QueueRepo.getQueue(db, targetChannelId);
  },

  getPosition(targetChannelId, userId) {
    const db = getDb();
    return QueueRepo.getPosition(db, targetChannelId, userId);
  },

  getTotalWaiting(targetChannelId) {
    const db = getDb();
    return QueueRepo.getTotalWaiting(db, targetChannelId);
  },

  isInQueue(userId, targetChannelId) {
    const db = getDb();
    return QueueRepo.isInQueue(db, userId, targetChannelId);
  },

  async processNext(client, targetChannel) {
    const db = getDb();
    const queue = QueueRepo.getQueue(db, targetChannel.id);

    if (queue.length === 0) return null;

    const next = queue[0];
    const guild = targetChannel.guild;
    const member = await guild.members.fetch(next.user_id).catch(() => null);

    if (!member || !member.voice?.channelId) {
      QueueRepo.leave(db, guild.id, targetChannel.id, next.user_id);
      return this.processNext(client, targetChannel);
    }

    try {
      await member.voice.setChannel(targetChannel.id, 'Voice queue - next in line');
      QueueRepo.markJoined(db, next.id);
      logger.info('VCQUEUE', `Moved ${next.user_id} to ${targetChannel.name}`);
      return member;
    } catch (err) {
      logger.error('VCQUEUE', `Failed to move ${next.user_id}: ${err.message}`);
      QueueRepo.leave(db, guild.id, targetChannel.id, next.user_id);
      return null;
    }
  },

  clearQueue(guildId, targetChannelId) {
    const db = getDb();
    QueueRepo.clearQueue(db, targetChannelId);
  },

  getActiveQueuesForUser(userId) {
    const db = getDb();
    return QueueRepo.getActiveQueuesForUser(db, userId);
  },
};
