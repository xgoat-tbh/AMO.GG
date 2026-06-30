export const TempRoleRepo = {
  assign(db, userId, roleId, guildId, duration, assignedBy) {
    const expiresAt = Math.floor(Date.now() / 1000) + duration;
    const stmt = db.prepare(`
      INSERT INTO temp_roles (user_id, role_id, guild_id, duration, assigned_at, expires_at, assigned_by)
      VALUES (?, ?, ?, ?, unixepoch(), ?, ?)
    `);
    const result = stmt.run(userId, roleId, guildId, duration, expiresAt, assignedBy);
    return db.prepare('SELECT * FROM temp_roles WHERE id = ?').get(result.lastInsertRowid);
  },

  getDueForExpiry(db) {
    return db.prepare(`
      SELECT * FROM temp_roles
      WHERE expired = 0 AND expires_at <= unixepoch()
    `).all();
  },

  markExpired(db, id) {
    db.prepare('UPDATE temp_roles SET expired = 1 WHERE id = ?').run(id);
  },

  getActiveForUser(db, userId, guildId) {
    return db.prepare(`
      SELECT * FROM temp_roles
      WHERE user_id = ? AND guild_id = ? AND expired = 0
      ORDER BY expires_at ASC
    `).all(userId, guildId);
  },

  getActiveByRole(db, roleId, guildId) {
    return db.prepare(`
      SELECT * FROM temp_roles
      WHERE role_id = ? AND guild_id = ? AND expired = 0
    `).all(roleId, guildId);
  },

  getHistory(db, userId, guildId, limit = 10) {
    return db.prepare(`
      SELECT * FROM temp_roles
      WHERE user_id = ? AND guild_id = ?
      ORDER BY assigned_at DESC LIMIT ?
    `).all(userId, guildId, limit);
  },

  removeActiveForUser(db, userId, guildId) {
    const records = db.prepare(`
      SELECT * FROM temp_roles
      WHERE user_id = ? AND guild_id = ? AND expired = 0
    `).all(userId, guildId);
    db.prepare(`
      UPDATE temp_roles SET expired = 1
      WHERE user_id = ? AND guild_id = ? AND expired = 0
    `).run(userId, guildId);
    return records;
  },
};
