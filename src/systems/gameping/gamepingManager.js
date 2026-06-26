import { getDb } from '../../database/connection.js';
import { GamepingRepo } from '../../database/repositories/gameping.repo.js';
import { logger } from '../../helpers/logger.js';

// ── Public API ──────────────────────────────────────────────────

/**
 * Execute a gameping alias — pings a role in the channel with a message.
 *
 * @param {string} alias - The alias name to execute
 * @param {GuildMember} member - The member executing the ping
 * @param {TextChannel} channel - The channel to send the ping in
 * @returns {{ success?: boolean, error?: string }}
 */
export async function execute(alias, customMessage, member, channel) {
  const db = getDb();

  const aliasData = GamepingRepo.getAlias(db, alias);
  if (!aliasData) {
    return { error: 'Alias not found' };
  }

  const { role_id: roleId, required_role_id: requiredRoleId } = aliasData;

  // Check required role if configured
  if (requiredRoleId && !member.roles.cache.has(requiredRoleId)) {
    return { error: 'Missing required role' };
  }

  // Send the ping
  await channel.send({
    content: `<@&${roleId}> ${customMessage}`,
    allowedMentions: { roles: [roleId] },
  });

  logger.info('GAMEPING', `${member.id} executed alias "${alias}" in #${channel.name}`);
  return { success: true };
}

/**
 * Add a new gameping alias.
 */
export function addAlias(alias, roleId, requiredRoleId) {
  const db = getDb();
  return GamepingRepo.addAlias(db, alias, roleId, requiredRoleId);
}

/**
 * Remove a gameping alias.
 * @returns {boolean} Whether the alias existed and was removed
 */
export function removeAlias(alias) {
  const db = getDb();
  return GamepingRepo.removeAlias(db, alias);
}

/**
 * Edit a field on an existing alias.
 * @param {string} alias - The alias to edit
 * @param {'role_id'|'required_role_id'} field - The field to update
 * @param {string} value - The new value
 */
export function editAlias(alias, field, value) {
  const db = getDb();
  return GamepingRepo.editAlias(db, alias, field, value);
}

/**
 * List all gameping aliases.
 */
export function listAliases() {
  const db = getDb();
  return GamepingRepo.listAliases(db);
}

export const gamepingManager = {
  execute,
  addAlias,
  removeAlias,
  editAlias,
  listAliases,
};
