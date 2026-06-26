import { getDb } from '../database/connection.js';
import { ConfigRepo } from '../database/repositories/config.repo.js';
import { config as staticConfig } from '../config/bot.config.js';

// Map bot config paths to DB keys
const keyMap = {
  'channels.suggestion': 'suggestion_channel',
  'channels.confession': 'confession_channel',
  'jailRoleId': 'jail_role_id',
  'channels.log': 'log_channel',
  'gamepingRoleId': 'gameping_role_id',
  'gamepingPermission': 'gameping_permission',
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

    if (prop === 'gamepingRoleId') {
      return getConfig('gamepingRoleId');
    }

    if (prop === 'gamepingPermission') {
      return getConfig('gamepingPermission');
    }

    // Default fallback to static config property
    return target[prop];
  },
});
