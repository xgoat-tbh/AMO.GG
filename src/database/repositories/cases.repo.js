export const CasesRepo = {
  create(db, { guildId, action, moderatorId, targetId, reason, duration, channelId, messageLink }) {
    const caseId = `${action.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO cases (case_id, guild_id, action, moderator_id, target_id, reason, duration, channel_id, message_link)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(caseId, guildId, action, moderatorId, targetId, reason || null, duration || null, channelId || null, messageLink || null);
    return { caseId, ...stmt.lastInsertRowid };
  },

  getByCaseId(db, caseId) {
    return db.prepare('SELECT * FROM cases WHERE case_id = ?').get(caseId);
  },

  getByTarget(db, targetId, limit = 10) {
    return db.prepare('SELECT * FROM cases WHERE target_id = ? ORDER BY created_at DESC LIMIT ?').all(targetId, limit);
  },

  getByModerator(db, moderatorId, limit = 10) {
    return db.prepare('SELECT * FROM cases WHERE moderator_id = ? ORDER BY created_at DESC LIMIT ?').all(moderatorId, limit);
  },

  getByGuild(db, guildId, limit = 25) {
    return db.prepare('SELECT * FROM cases WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?').all(guildId, limit);
  },

  countByTarget(db, targetId) {
    return db.prepare('SELECT COUNT(*) as count FROM cases WHERE target_id = ?').get(targetId).count;
  },

  getRecentByTarget(db, targetId, action, minutes = 60) {
    const cutoff = Math.floor(Date.now() / 1000) - (minutes * 60);
    return db.prepare('SELECT * FROM cases WHERE target_id = ? AND action = ? AND created_at > ? ORDER BY created_at DESC').all(targetId, action, cutoff);
  },
};
