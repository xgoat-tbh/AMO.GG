export const XpRepo = {
  get(db, userId, guildId) {
    return db.prepare('SELECT * FROM xp WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  },

  ensure(db, userId, guildId) {
    const existing = this.get(db, userId, guildId);
    if (existing) return existing;
    db.prepare('INSERT OR IGNORE INTO xp (user_id, guild_id, xp, level) VALUES (?, ?, 0, 1)').run(userId, guildId);
    return this.get(db, userId, guildId);
  },

  addXp(db, userId, guildId, amount) {
    this.ensure(db, userId, guildId);
    db.prepare('UPDATE xp SET xp = xp + ?, last_message = unixepoch() WHERE user_id = ? AND guild_id = ?').run(amount, userId, guildId);
    const row = this.get(db, userId, guildId);
    return row;
  },

  addVoiceXp(db, userId, guildId, amount) {
    this.ensure(db, userId, guildId);
    db.prepare('UPDATE xp SET voice_xp = voice_xp + ?, last_voice = unixepoch() WHERE user_id = ? AND guild_id = ?').run(amount, userId, guildId);
  },

  setLevel(db, userId, guildId, level) {
    db.prepare('UPDATE xp SET level = ? WHERE user_id = ? AND guild_id = ?').run(level, userId, guildId);
  },

  setXp(db, userId, guildId, xp) {
    db.prepare('UPDATE xp SET xp = ? WHERE user_id = ? AND guild_id = ?').run(xp, userId, guildId);
  },

  getLeaderboard(db, guildId, limit = 10) {
    return db.prepare('SELECT * FROM xp WHERE guild_id = ? ORDER BY xp DESC LIMIT ?').all(guildId, limit);
  },

  getRank(db, userId, guildId) {
    const row = db.prepare('SELECT COUNT(*) + 1 as rank FROM xp WHERE guild_id = ? AND xp > (SELECT COALESCE(xp, 0) FROM xp WHERE user_id = ? AND guild_id = ?)').get(guildId, userId, guildId);
    return row?.rank || 1;
  },

  getConfig(db, guildId) {
    let config = db.prepare('SELECT * FROM xp_config WHERE guild_id = ?').get(guildId);
    if (!config) {
      db.prepare('INSERT INTO xp_config (guild_id) VALUES (?)').run(guildId);
      config = db.prepare('SELECT * FROM xp_config WHERE guild_id = ?').get(guildId);
    }
    return config;
  },

  updateConfig(db, guildId, updates) {
    const keys = Object.keys(updates);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updates[k]);
    db.prepare(`UPDATE xp_config SET ${setClause} WHERE guild_id = ?`).run(...values, guildId);
  },

  getRewards(db, guildId) {
    return db.prepare('SELECT * FROM xp_rewards WHERE guild_id = ? ORDER BY level ASC').all(guildId);
  },

  addReward(db, guildId, level, roleId, description, icon) {
    db.prepare('INSERT OR REPLACE INTO xp_rewards (guild_id, level, role_id, description, icon) VALUES (?, ?, ?, ?, ?)')
      .run(guildId, level, roleId, description || null, icon || null);
  },

  removeReward(db, guildId, level) {
    db.prepare('DELETE FROM xp_rewards WHERE guild_id = ? AND level = ?').run(guildId, level);
  },

  clearRewards(db, guildId) {
    db.prepare('DELETE FROM xp_rewards WHERE guild_id = ?').run(guildId);
  },
};

export function xpForLevel(level) {
  return Math.floor(100 * (level ** 2.5));
}

export function levelFromXp(xp) {
  return Math.max(1, Math.floor((xp / 100) ** (1 / 2.5)));
}
