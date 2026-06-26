import { metricsManager } from '../../helpers/metricsManager.js';

/**
 * Config repository — CRUD operations for database-backed bot config overrides.
 */
export const ConfigRepo = {
  cache: new Map(),

  get(db, key) {
    if (this.cache.has(key)) {
      metricsManager.recordCacheHit();
      return this.cache.get(key);
    }
    metricsManager.recordCacheMiss();
    const row = db.prepare('SELECT value FROM bot_config WHERE key = ?').get(key);
    const value = row ? row.value : null;
    this.cache.set(key, value);
    return value;
  },

  set(db, key, value) {
    db.prepare(
      'INSERT INTO bot_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, value);
    this.cache.set(key, value);
    return value;
  },

  delete(db, key) {
    db.prepare('DELETE FROM bot_config WHERE key = ?').run(key);
    this.cache.delete(key);
  },

  clearAll(db) {
    db.prepare('DELETE FROM bot_config').run();
    this.cache.clear();
  },

  getAll(db) {
    const rows = db.prepare('SELECT * FROM bot_config').all();
    const configMap = {};
    this.cache.clear();
    for (const row of rows) {
      configMap[row.key] = row.value;
      this.cache.set(row.key, row.value);
    }
    return configMap;
  },
};
