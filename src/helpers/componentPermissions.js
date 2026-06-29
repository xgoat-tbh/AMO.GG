import { checkPermission, isBotOwner } from './permissions.js';
import { emojis } from '../config/emojis.config.js';
import { logger } from './logger.js';

/**
 * Component permission definitions.
 * Maps customId prefixes to required permission levels.
 * 'owner' = guild owner only
 * 'admin' = admin roles + guild owner + ADMINISTRATOR permission
 * 'moderator' = moderator roles + MODERATE_MEMBERS + admin
 * 'everyone' = no restriction
 * 'creator' = special check: only the VC creator (validated in handler)
 * 'executor' = only the user who triggered the original command (stored in customId)
 */
export const COMPONENT_PERMISSIONS = {
  // Config system - executor only
  'config:nav': { level: 'executor' },
  'config:back': { level: 'executor' },
  'config:edit': { level: 'executor' },
  'config:text_edit': { level: 'executor' },
  'config:text_save': { level: 'executor' },
  'config:section_set': { level: 'executor' },
  'config:clear': { level: 'executor' },
  'config:close': { level: 'executor' },

  // GPVC system - creator only (validated in handler via DB)
  'gpvc:select_game': { level: 'creator' },
  'gpvc:btn_config': { level: 'creator' },
  'gpvc:btn_create': { level: 'creator' },
  'gpvc:manage': { level: 'creator' },
  'gpvc:select_kick': { level: 'creator' },
  'gpvc:select_trust': { level: 'creator' },
  'gpvc:select_untrust': { level: 'creator' },
  'gpvc:select_regame': { level: 'creator' },
  'gpvc:modal_config': { level: 'creator' },
  'gpvc:modal_status': { level: 'creator' },
  'gpvc:modal_relimit': { level: 'creator' },

  // Suggestion system - everyone for voting, moderator for completion
  'suggestion:vote': { level: 'everyone' },
  'suggestion:complete': { level: 'moderator' },
  'suggestion:thread': { level: 'everyone' },

  // Confession system - everyone
  'confession:known': { level: 'everyone' },
  'confession:anonymous': { level: 'everyone' },

  // Giveaway system - everyone for entering
  'giveaway:enter': { level: 'everyone' },

  // Help system - everyone
  'help:page': { level: 'everyone' },
  'help:sort': { level: 'everyone' },
  'help:btn_list': { level: 'everyone' },
  'help:btn_home': { level: 'everyone' },
  'help:back': { level: 'everyone' },
  'help:category': { level: 'everyone' },
  'help:command': { level: 'everyone' },
  'help:nav': { level: 'everyone' },
  'help:cat_page': { level: 'everyone' },
  'help:cat_page_ind': { level: 'everyone' },
  'help:search': { level: 'everyone' },
  'help:cmd_list': { level: 'everyone' },
  'help:support': { level: 'everyone' },
  'help:support:modal': { level: 'everyone' },
  'list_pagination': { level: 'everyone' },
  'jail:refresh': { level: 'executor' },
  'move:accept': { level: 'executor' },
  'move:decline': { level: 'executor' },
  'mod:confirm': { level: 'executor' },
  'mod:cancel': { level: 'executor' },

  // Jail role management - executor only
  'config:jail_create': { level: 'executor' },
  'config:jail_delete': { level: 'executor' },

  // Admin reset - executor only (admin verified in command)
  'admin:reset_confirm': { level: 'executor' },
  'admin:reset_cancel': { level: 'executor' },

  // Snipe system - everyone
  'snipe:user': { level: 'everyone' },
  'snipe:back': { level: 'everyone' },
  'snipe:page': { level: 'everyone' },

  // Dev logs - dev only
  'dev:logs': { level: 'dev' },

  // Embed builder - moderator (validated in command)
  'embed:edit': { level: 'moderator' },
  'embed:publish': { level: 'moderator' },
  'embed:cancel': { level: 'moderator' },
};

/**
 * Extract the executor ID from customId if present.
 * Format: prefix:action:executorId:...
 */
function extractExecutorId(customId) {
  const parts = customId.split(':');
  // Check if last part is a user ID (17-19 digit snowflake)
  const lastPart = parts[parts.length - 1];
  if (/^\d{17,19}$/.test(lastPart)) {
    return lastPart;
  }
  // For config:select:executorId format
  if (parts.length >= 3 && /^\d{17,19}$/.test(parts[2])) {
    return parts[2];
  }
  return null;
}

/**
 * Get the permission requirement for a customId.
 * Tries exact match first, then prefix match.
 */
export function getPermissionRequirement(customId) {
  // Try exact match
  if (COMPONENT_PERMISSIONS[customId]) {
    return COMPONENT_PERMISSIONS[customId];
  }

  // Try prefix match (e.g., 'config:select' matches 'config:select:123')
  for (const [prefix, perm] of Object.entries(COMPONENT_PERMISSIONS)) {
    if (customId.startsWith(prefix + ':')) {
      return perm;
    }
  }

  // Try two-part prefix match (e.g., 'gpvc:manage' matches 'gpvc:manage:status:123')
  const parts = customId.split(':');
  if (parts.length >= 2) {
    const twoPartPrefix = `${parts[0]}:${parts[1]}`;
    if (COMPONENT_PERMISSIONS[twoPartPrefix]) {
      return COMPONENT_PERMISSIONS[twoPartPrefix];
    }
  }

  // Default to moderator for unknown components (safe default)
  return { level: 'moderator' };
}

/**
 * Check if a member has permission for a component interaction.
 */
export async function checkComponentPermission(interaction, requirement) {
  const { level } = requirement;
  const member = interaction.member;
  const user = interaction.user;

  switch (level) {
    case 'dev':
      return isBotOwner(user);

    case 'executor': {
      const executorId = extractExecutorId(interaction.customId);
      if (!executorId) {
        logger.warn('COMPONENT_PERM', `No executor ID found in customId: ${interaction.customId}`);
        return false;
      }
      return user.id === executorId;
    }

    case 'creator':
      // Creator validation is done in individual handlers via DB lookup
      // Return true here to allow handler to do the actual check
      return true;

    case 'moderator':
      return checkPermission(member, 'moderator');

    case 'admin':
      return checkPermission(member, 'admin');

    case 'owner':
      return member.id === member.guild.ownerId;

    case 'everyone':
      return true;

    default:
      return false;
  }
}

/**
 * Send a permission denied response for component interactions.
 */
export async function sendComponentPermissionDenied(interaction) {
  const content = `${emojis.error} You don't have permission to use this interaction.`;

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, flags: 64 }); // Ephemeral
    } else {
      await interaction.reply({ content, flags: 64 }); // Ephemeral
    }
  } catch {
    // Ignore errors
  }
}