import { getDb } from '../../database/connection.js';
import { JailRepo } from '../../database/repositories/jail.repo.js';
import { botConfig as config } from '../../helpers/configHelper.js';
import { logger } from '../../helpers/logger.js';

// ── Public API ──────────────────────────────────────────────────

/**
 * Jail a member: strip all removable roles, store them in DB, add jail role.
 *
 * @param {GuildMember} member - The member to jail
 * @param {GuildMember|User} moderator - The moderator performing the action
 * @param {string} [reason] - Optional reason
 * @returns {object} The jail record
 */
export async function jail(member, moderator, reason) {
  const db = getDb();

  // Get member's current roles (excluding @everyone and managed/bot roles)
  const currentRoles = member.roles.cache
    .filter((role) => role.id !== member.guild.id && !role.managed)
    .map((role) => role.id);

  // Create jail record in DB
  const record = JailRepo.jail(db, member.id, moderator.id, reason);

  // Store the member's current roles for later restoration
  if (currentRoles.length > 0) {
    JailRepo.storeRoles(db, record.id, currentRoles);
  }

  // Remove all stored roles from the member
  for (const roleId of currentRoles) {
    try {
      await member.roles.remove(roleId, 'Jailed — roles stripped');
    } catch (error) {
      logger.warn('JAIL', `Failed to remove role ${roleId} from ${member.id}: ${error.message}`);
    }
  }

  // Add jail role
  if (config.jailRoleId) {
    try {
      await member.roles.add(config.jailRoleId, `Jailed by ${moderator.id}: ${reason || 'No reason'}`);
    } catch (error) {
      logger.error('JAIL', `Failed to add jail role to ${member.id}: ${error.message}`, error);
    }
  } else {
    logger.warn('JAIL', 'No jail role ID configured (JAIL_ROLE_ID). Member was not given a jail role.');
  }

  logger.info('JAIL', `Jailed ${member.id} by ${moderator.id}. Stored ${currentRoles.length} roles.`);
  return record;
}

/**
 * Unjail a member: remove jail role, restore all stored roles.
 *
 * @param {GuildMember} member - The member to unjail
 * @param {GuildMember|User} moderator - The moderator performing the action
 * @returns {object|null} The jail record, or null if not jailed
 */
export async function unjail(member, moderator) {
  const db = getDb();

  // Get active jail record
  const activeRecord = JailRepo.getActive(db, member.id);
  if (!activeRecord) {
    return null;
  }

  // Get stored roles
  const storedRoleIds = JailRepo.getStoredRoles(db, activeRecord.id);

  // Remove jail role
  if (config.jailRoleId) {
    try {
      await member.roles.remove(config.jailRoleId, `Unjailed by ${moderator.id}`);
    } catch (error) {
      logger.warn('JAIL', `Failed to remove jail role from ${member.id}: ${error.message}`);
    }
  }

  // Restore all stored roles
  let restored = 0;
  for (const roleId of storedRoleIds) {
    try {
      await member.roles.add(roleId, 'Unjailed — roles restored');
      restored++;
    } catch (error) {
      logger.warn('JAIL', `Failed to restore role ${roleId} to ${member.id}: ${error.message}`);
    }
  }

  // Mark as unjailed in DB
  const record = JailRepo.unjail(db, member.id, moderator.id);

  logger.info('JAIL', `Unjailed ${member.id} by ${moderator.id}. Restored ${restored}/${storedRoleIds.length} roles.`);
  return record;
}

/**
 * Check if a user is currently jailed.
 *
 * @param {string} userId
 * @returns {boolean}
 */
export function isJailed(userId) {
  const db = getDb();
  const record = JailRepo.getActive(db, userId);
  return !!record;
}

/**
 * Get the jail history for a user.
 *
 * @param {string} userId
 * @returns {object[]}
 */
export function getHistory(userId) {
  const db = getDb();
  return JailRepo.getHistory(db, userId);
}

export const jailManager = {
  jail,
  unjail,
  isJailed,
  getHistory,
};
