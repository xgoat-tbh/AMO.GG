import { getDb } from '../../database/connection.js';
import { TempRoleRepo } from '../../database/repositories/temprole.repo.js';
import { logger } from '../../helpers/logger.js';

const EXPIRY_INTERVAL = 30000;

let expiryTicker = null;

export const tempRoleManager = {
  startTicker(client) {
    if (expiryTicker) clearInterval(expiryTicker);
    expiryTicker = setInterval(() => this.processExpired(client), EXPIRY_INTERVAL);
    logger.info('TEMPROLE', 'Temp role expiry ticker started');
  },

  stopTicker() {
    if (expiryTicker) {
      clearInterval(expiryTicker);
      expiryTicker = null;
    }
  },

  async assignTempRole(member, role, duration, assignedBy) {
    const db = getDb();
    const record = TempRoleRepo.assign(db, member.id, role.id, member.guild.id, duration, assignedBy.id);
    await member.roles.add(role, `Temporary role (${duration}s) assigned by ${assignedBy.tag}`).catch(err => {
      logger.error('TEMPROLE', `Failed to add role ${role.id} to ${member.id}: ${err.message}`);
      return null;
    });
    return record;
  },

  async processExpired(client) {
    const db = getDb();
    const due = TempRoleRepo.getDueForExpiry(db);

    for (const record of due) {
      try {
        const guild = client.guilds.cache.get(record.guild_id);
        if (!guild) {
          TempRoleRepo.markExpired(db, record.id);
          continue;
        }

        const member = await guild.members.fetch(record.user_id).catch(() => null);
        if (member) {
          const role = guild.roles.cache.get(record.role_id);
          if (role) {
            await member.roles.remove(role, 'Temporary role expired').catch(() => null);
          }
        }

        TempRoleRepo.markExpired(db, record.id);
        logger.info('TEMPROLE', `Expired temp role ${record.role_id} for ${record.user_id}`);
      } catch (err) {
        logger.error('TEMPROLE', `Error processing temp role expiry #${record.id}: ${err.message}`);
      }
    }
  },

  getActiveForUser(userId, guildId) {
    const db = getDb();
    return TempRoleRepo.getActiveForUser(db, userId, guildId);
  },

  getHistory(userId, guildId, limit) {
    const db = getDb();
    return TempRoleRepo.getHistory(db, userId, guildId, limit);
  },

  async removeAllForUser(member) {
    const db = getDb();
    const records = TempRoleRepo.removeActiveForUser(db, member.id, member.guild.id);
    for (const record of records) {
      const role = member.guild.roles.cache.get(record.role_id);
      if (role) {
        await member.roles.remove(role, 'Temporary roles manually removed').catch(() => null);
      }
    }
    return records;
  },
};
