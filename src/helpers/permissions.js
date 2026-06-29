import { PermissionFlagsBits } from 'discord.js';
import { permConfig } from '../config/permissions.config.js';

/**
 * Permission checking utilities.
 */

/**
 * Check if a member has the specified permission level.
 */
export function checkPermission(member, level) {
  if (!member) return false;

  switch (level) {
    case 'dev':
      return isBotOwner(member.user);
    case 'owner':
      return isOwner(member);
    case 'admin':
      return isAdmin(member);
    case 'moderator':
      return isModerator(member);
    case 'everyone':
      return true;
    default:
      return false;
  }
}

/**
 * Check if a user is the bot owner / developer.
 */
export function isBotOwner(user) {
  if (!user) return false;
  if (process.env.OWNER_ID && user.id === process.env.OWNER_ID) return true;
  return false;
}

/**
 * Check if member is the guild owner.
 */
export function isOwner(member) {
  return member.id === member.guild.ownerId;
}

/**
 * Check if member is an admin.
 * Admin = has admin role, or has ADMINISTRATOR permission, or is owner.
 */
export function isAdmin(member) {
  if (isOwner(member)) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return permConfig.adminRoles.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Check if member is a moderator.
 * Moderator = has mod role, has MODERATE_MEMBERS permission, or is admin.
 */
export function isModerator(member) {
  if (isAdmin(member)) return true;
  if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) return true;
  return permConfig.moderatorRoles.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Check if member is immune (for voice lockdown).
 */
export function isImmune(member) {
  if (isModerator(member)) return true;
  return permConfig.immuneRoles.some(roleId => member.roles.cache.has(roleId));
}
