import { getDb } from '../../database/connection.js';
import { JailRepo } from '../../database/repositories/jail.repo.js';
import { botConfig } from '../../helpers/configHelper.js';
import { logger } from '../../helpers/logger.js';

export const jailManager = {
  async jail(member, moderator, reason, duration = null) {
    const db = getDb();

    // Store current roles
    const currentRoles = member.roles.cache
      .filter(r => r.id !== member.guild.id && !r.managed)
      .map(r => r.id);

    // Remove all roles
    await member.roles.set([], `Jailed by ${moderator.user.tag}: ${reason || 'No reason'}`);

    // Add jail role
    const jailRoleId = botConfig.jailRoleId;
    if (jailRoleId) {
      const jailRole = member.guild.roles.cache.get(jailRoleId);
      if (jailRole) {
        await member.roles.add(jailRole);
      }
    } else {
      throw new Error('Jail role is not configured. Use ?config to set a jail role.');
    }

    // Create record
    const record = JailRepo.jail(db, member.id, moderator.id, reason, duration);

    // Store roles
    if (record && currentRoles.length > 0) {
      JailRepo.storeRoles(db, record.id, currentRoles);
    }

    return record;
  },

  async unjail(member, moderator) {
    const db = getDb();
    const active = JailRepo.getActive(db, member.id);
    if (!active) return false;

    // Remove jail role
    const jailRoleId = botConfig.jailRoleId;
    if (jailRoleId && member.roles.cache.has(jailRoleId)) {
      await member.roles.remove(jailRoleId);
    }

    // Restore stored roles
    const storedRoleIds = JailRepo.getStoredRoles(db, active.id);
    if (storedRoleIds.length > 0) {
      const validRoles = storedRoleIds
        .map(id => member.guild.roles.cache.get(id))
        .filter(r => r && r.id !== member.guild.id && !r.managed);
      if (validRoles.length > 0) {
        await member.roles.add(validRoles);
      }
    }

    // Update record
    JailRepo.unjailActiveByUser(db, member.id, moderator.id);
    return true;
  },

  isJailed(userId) {
    const db = getDb();
    return !!JailRepo.getActive(db, userId);
  },

  getHistory(userId, limit = 10) {
    const db = getDb();
    return JailRepo.getHistory(db, userId, limit);
  },

  getDueForRelease() {
    const db = getDb();
    return JailRepo.getDueForRelease(db);
  },

  getStats() {
    const db = getDb();
    return JailRepo.getStats(db);
  },

  getRecent() {
    const db = getDb();
    return JailRepo.getRecent(db);
  },

  getActiveAll() {
    const db = getDb();
    return JailRepo.getActiveAll(db);
  },
};
