import { logger } from '../../helpers/logger.js';
import { processBatch } from '../../helpers/batchProcessor.js';

// ── Public API ──────────────────────────────────────────────────

/**
 * Toggle a role on a member: remove if they have it, add if they don't.
 *
 * @param {GuildMember} member
 * @param {Role} role
 * @returns {'added'|'removed'}
 */
export async function toggleRole(member, role) {
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role);
    return 'removed';
  } else {
    await member.roles.add(role);
    return 'added';
  }
}

/**
 * Toggle a role on multiple members. Uses the batch processor for rate-limit safety.
 *
 * @param {GuildMember[]} members - Array of members to process
 * @param {Role} role - The role to toggle
 * @param {Function} [onProgress] - Optional progress callback (completed, total)
 * @returns {{ added: number, removed: number, failed: number }}
 */
export async function toggleRoleBulk(members, role, onProgress) {
  let added = 0;
  let removed = 0;

  const result = await processBatch(
    members,
    async (member) => {
      const action = await toggleRole(member, role);
      if (action === 'added') added++;
      else removed++;
    },
    {
      concurrency: 3,
      onProgress,
      progressInterval: 2000,
    }
  );

  return { added, removed, failed: result.failed };
}

/**
 * Get all members in the guild who have a specific role.
 * Fetches all guild members if the cache appears insufficient.
 *
 * @param {Guild} guild
 * @param {Role} role
 * @returns {GuildMember[]}
 */
export async function getInRoleMembers(guild, role) {
  // If cache seems small relative to guild size, fetch all members first
  if (guild.members.cache.size < guild.memberCount * 0.8) {
    try {
      await guild.members.fetch();
    } catch (error) {
      logger.warn('ROLES', `Could not fetch all guild members: ${error.message}`);
    }
  }

  return guild.members.cache.filter((m) => m.roles.cache.has(role.id));
}

export const roleManager = {
  toggleRole,
  toggleRoleBulk,
  getInRoleMembers,
};
