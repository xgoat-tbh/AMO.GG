import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { logger } from './logger.js';
import { botConfig as config } from './configHelper.js';

const VALID_PERMISSIONS = ['everyone', 'moderator', 'admin'];

/**
 * Validate a single config value
 */
export async function validateConfigValue(client, guildId, dbKey, value) {
  if (!value || value === 'null' || value === 'undefined' || value === '') {
    return { valid: true }; // Empty is valid (clears override)
  }

  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return { valid: false, reason: 'Guild not found' };
    }

    // Map DB keys to validation logic
    switch (dbKey) {
      case 'suggestion_channel':
      case 'confession_channel':
      case 'log_channel':
      case 'creator_announcements_channel_id':
      case 'creator_commands_channel_id':
      case 'creator_ideas_channel_id':
      case 'creator_chat_channel_id': {
        const channel = await guild.channels.fetch(value).catch(() => null);
        if (!channel) {
          return { valid: false, reason: 'Channel not found' };
        }
        if (!channel.isTextBased()) {
          return { valid: false, reason: 'Channel must be a text channel' };
        }
        // Check bot permissions
        const perms = channel.permissionsFor(guild.members.me);
        if (!perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
          return { valid: false, reason: 'Bot lacks View Channel or Send Messages permission' };
        }
        break;
      }

      case 'jail_role_id':
      case 'gameping_role_id':
      case 'creator_role_id': {
        const role = await guild.roles.fetch(value).catch(() => null);
        if (!role) {
          return { valid: false, reason: 'Role not found' };
        }
        if (role.managed) {
          return { valid: false, reason: 'Cannot use managed (integration) roles' };
        }
        // Check if bot's highest role is above this role
        const botMember = await guild.members.fetchMe();
        if (role.position >= botMember.roles.highest.position) {
          return { valid: false, reason: 'Bot\'s highest role must be above this role' };
        }
        break;
      }

      case 'creator_role_ids': {
        const roleIds = value.split(',').map(id => id.trim()).filter(Boolean);
        for (const roleId of roleIds) {
          const role = await guild.roles.fetch(roleId).catch(() => null);
          if (!role) {
            return { valid: false, reason: `Role ${roleId} not found` };
          }
          if (role.managed) {
            return { valid: false, reason: `Cannot use managed role ${roleId}` };
          }
          const botMember = await guild.members.fetchMe();
          if (role.position >= botMember.roles.highest.position) {
            return { valid: false, reason: `Bot's highest role must be above role ${roleId}` };
          }
        }
        break;
      }

      case 'gameping_permission': {
        if (!VALID_PERMISSIONS.includes(value.toLowerCase())) {
          return { valid: false, reason: `Invalid permission. Must be one of: ${VALID_PERMISSIONS.join(', ')}` };
        }
        break;
      }

      case 'creator_category_id': {
        const channel = await guild.channels.fetch(value).catch(() => null);
        if (!channel) {
          return { valid: false, reason: 'Category not found' };
        }
        if (channel.type !== ChannelType.GuildCategory) {
          return { valid: false, reason: 'Must be a category channel' };
        }
        break;
      }

      case 'maintenance_mode': {
        if (!['true', 'false'].includes(value.toLowerCase())) {
          return { valid: false, reason: 'Must be "true" or "false"' };
        }
        break;
      }
    }

    // Role group and notification target validation (multi-role)
    if (dbKey.startsWith('role_group_') || dbKey.startsWith('notify_')) {
      const roleIds = value.split(',').map(id => id.trim()).filter(Boolean);
      for (const roleId of roleIds) {
        const role = await guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
          return { valid: false, reason: `Role ${roleId} not found` };
        }
        if (role.managed) {
          return { valid: false, reason: `Cannot use managed role ${roleId}` };
        }
      }
    }

    return { valid: true };
  } catch (error) {
    logger.error('CONFIG_VALIDATE', `Error validating ${dbKey}: ${error.message}`, error);
    return { valid: false, reason: 'Validation error' };
  }
}

/**
 * Validate all config overrides in the database
 */
export async function validateAllConfig(client, guildId) {
  const db = await import('../database/connection.js').then(m => m.getDb());
  const { ConfigRepo } = await import('../database/repositories/config.repo.js');

  const overrides = ConfigRepo.getAll(db);
  const results = { valid: [], invalid: [] };

  for (const [key, value] of Object.entries(overrides)) {
    const validation = await validateConfigValue(client, guildId, key, value);
    if (validation.valid) {
      results.valid.push({ key, value });
    } else {
      results.invalid.push({ key, value, reason: validation.reason });
    }
  }

  return results;
}