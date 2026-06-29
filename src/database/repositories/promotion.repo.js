const DEFAULT_GAME_DOMAINS = [
  'richup.io', 'codenames.game', 'skribbl.io', 'smashkarts.io',
  'gartic.io', 'chess.com', 'lichess.org', 'boardgamearena.com', 'jackbox.tv',
];

export const PromotionRepo = {
  getConfig(db, guildId) {
    let config = db.prepare('SELECT * FROM promotion_config WHERE guild_id = ?').get(guildId);
    if (!config) {
      db.prepare('INSERT INTO promotion_config (guild_id) VALUES (?)').run(guildId);
      config = db.prepare('SELECT * FROM promotion_config WHERE guild_id = ?').get(guildId);
    }
    return config;
  },

  updateConfig(db, guildId, updates) {
    this.getConfig(db, guildId);
    const keys = Object.keys(updates);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updates[k]);
    db.prepare(`UPDATE promotion_config SET ${setClause} WHERE guild_id = ?`).run(...values, guildId);
  },

  getWhitelist(db, guildId) {
    const defaults = db.prepare("SELECT domain FROM promotion_whitelist WHERE guild_id = '_default'").all();
    const guild = db.prepare('SELECT domain FROM promotion_whitelist WHERE guild_id = ?').all(guildId);
    const all = [...new Set([...defaults.map(r => r.domain), ...guild.map(r => r.domain)])];
    return all;
  },

  addWhitelist(db, guildId, domain, addedBy) {
    db.prepare('INSERT OR IGNORE INTO promotion_whitelist (guild_id, domain, added_by) VALUES (?, ?, ?)').run(guildId, domain.toLowerCase(), addedBy);
  },

  removeWhitelist(db, guildId, domain) {
    db.prepare("DELETE FROM promotion_whitelist WHERE guild_id = ? AND domain = ? AND added_by != 'system'").run(guildId, domain.toLowerCase());
  },

  getBlacklist(db, guildId) {
    return db.prepare('SELECT domain FROM promotion_blacklist WHERE guild_id = ?').all(guildId).map(r => r.domain);
  },

  addBlacklist(db, guildId, domain, addedBy) {
    db.prepare('INSERT OR IGNORE INTO promotion_blacklist (guild_id, domain, added_by) VALUES (?, ?, ?)').run(guildId, domain.toLowerCase(), addedBy);
  },

  removeBlacklist(db, guildId, domain) {
    db.prepare('DELETE FROM promotion_blacklist WHERE guild_id = ? AND domain = ?').run(guildId, domain.toLowerCase());
  },

  isWhitelisted(db, guildId, domain) {
    const guildAllowed = db.prepare('SELECT 1 FROM promotion_whitelist WHERE guild_id = ? AND domain = ?').get(guildId, domain);
    if (guildAllowed) return true;
    const defaultAllowed = db.prepare("SELECT 1 FROM promotion_whitelist WHERE guild_id = '_default' AND domain = ?").get(domain);
    if (defaultAllowed) return true;
    return false;
  },

  isBlacklisted(db, guildId, domain) {
    return !!db.prepare('SELECT 1 FROM promotion_blacklist WHERE guild_id = ? AND domain = ?').get(guildId, domain);
  },
};
