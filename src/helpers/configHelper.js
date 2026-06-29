import { getDb } from '../database/connection.js';
import { ConfigRepo } from '../database/repositories/config.repo.js';
import { config as staticConfig } from '../config/bot.config.js';

// Map bot config paths to DB keys
const keyMap = {
  'channels.suggestion': 'suggestion_channel',
  'channels.confession': 'confession_channel',
  'jailRoleId': 'jail_role_id',
  'jailChannelId': 'jail_channel_id',
  'channels.log': 'log_channel',
  'gamepingRoleId': 'gameping_role_id',
  'gamepingPermission': 'gameping_permission',
  'creatorRoleId': 'creator_role_id',
  'creatorRoleIds': 'creator_role_ids',
  'creatorCategoryId': 'creator_category_id',
  'channels.creator.announcements': 'creator_announcements_channel_id',
  'channels.creator.commands': 'creator_commands_channel_id',
  'channels.creator.ideas': 'creator_ideas_channel_id',
  'channels.creator.chat': 'creator_chat_channel_id',

  // Role groups
  'role_group_moderators': 'role_group_moderators',
  'role_group_staff': 'role_group_staff',
  'role_group_creators': 'role_group_creators',
  'role_group_event_hosts': 'role_group_event_hosts',
  'role_group_managers': 'role_group_managers',

  // Notification targets
  'notify_mod_suggestion': 'notify_mod_suggestion',
  'notify_mod_ticket': 'notify_mod_ticket',
  'notify_mod_voice': 'notify_mod_voice',
  'notify_manager_config': 'notify_manager_config',
  'notify_manager_backup': 'notify_manager_backup',
  'notify_creator_request': 'notify_creator_request',
};

/**
 * Resolves a configuration path by checking the database override first,
 * then falling back to static config (env).
 */
export function getConfig(path) {
  try {
    const db = getDb();
    const dbKey = keyMap[path];
    if (dbKey) {
      const override = ConfigRepo.get(db, dbKey);
      if (override !== null && override !== undefined && override !== '') {
        return override;
      }
    }
  } catch (error) {
    // If database is not ready or has issues, fallback to static config silently
  }

  // Fallback to static config
  const parts = path.split('.');
  let current = staticConfig;
  for (const part of parts) {
    if (current == null) return null;
    current = current[part];
  }
  return current;
}

/**
 * Proxy object wrapping staticConfig. Intercepts property accesses
 * to return database overrides dynamically.
 */
export const botConfig = new Proxy(staticConfig, {
  get(target, prop) {
    if (prop === 'channels') {
      return {
        get suggestion() {
          return getConfig('channels.suggestion');
        },
        get confession() {
          return getConfig('channels.confession');
        },
        get log() {
          return getConfig('channels.log');
        },
        get creator() {
          return {
            get announcements() {
              return getConfig('channels.creator.announcements');
            },
            get commands() {
              return getConfig('channels.creator.commands');
            },
            get ideas() {
              return getConfig('channels.creator.ideas');
            },
            get chat() {
              return getConfig('channels.creator.chat');
            },
          };
        },
        get logs() {
          const mainLog = getConfig('channels.log');
          return {
            moderation: mainLog,
            voice: mainLog,
            roles: mainLog,
            confessions: mainLog,
            suggestions: mainLog,
            gameping: mainLog,
          };
        },
      };
    }

    if (prop === 'jailRoleId') {
      return getConfig('jailRoleId');
    }

    if (prop === 'jailChannelId') {
      return getConfig('jailChannelId');
    }

    if (prop === 'gamepingRoleId') {
      return getConfig('gamepingRoleId');
    }

    if (prop === 'gamepingPermission') {
      return getConfig('gamepingPermission');
    }

    if (prop === 'creatorRoleId') {
      return getConfig('creatorRoleId');
    }

    if (prop === 'creatorRoleIds') {
      const raw = getConfig('creatorRoleIds');
      if (raw && typeof raw === 'string') {
        return raw.split(',').map(id => id.trim()).filter(Boolean);
      }
      const single = getConfig('creatorRoleId');
      return single ? [single] : [];
    }

    if (prop === 'creatorCategoryId') {
      return getConfig('creatorCategoryId');
    }

    // Role groups
    if (prop === 'roleGroupModerators') {
      return parseRoles(getConfig('role_group_moderators'));
    }
    if (prop === 'roleGroupStaff') {
      return parseRoles(getConfig('role_group_staff'));
    }
    if (prop === 'roleGroupCreators') {
      return parseRoles(getConfig('role_group_creators'));
    }
    if (prop === 'roleGroupEventHosts') {
      return parseRoles(getConfig('role_group_event_hosts'));
    }
    if (prop === 'roleGroupManagers') {
      return parseRoles(getConfig('role_group_managers'));
    }

    // Notification targets
    if (prop === 'notifyModSuggestion') {
      return parseRoles(getConfig('notify_mod_suggestion'));
    }
    if (prop === 'notifyModTicket') {
      return parseRoles(getConfig('notify_mod_ticket'));
    }
    if (prop === 'notifyModVoice') {
      return parseRoles(getConfig('notify_mod_voice'));
    }
    if (prop === 'notifyManagerConfig') {
      return parseRoles(getConfig('notify_manager_config'));
    }
    if (prop === 'notifyManagerBackup') {
      return parseRoles(getConfig('notify_manager_backup'));
    }
    if (prop === 'notifyCreatorRequest') {
      return parseRoles(getConfig('notify_creator_request'));
    }

    // Default fallback to static config property
    return target[prop];
  },
});

/**
 * Parse a comma-separated role ID string into an array.
 */
function parseRoles(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map(id => id.trim()).filter(Boolean);
}
