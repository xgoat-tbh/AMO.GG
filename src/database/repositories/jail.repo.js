export const JailRepo = {
  jail(db, userId, moderatorId, reason, duration = null, channelId = null) {
    const stmt = db.prepare(`
      INSERT INTO jail_records (user_id, moderator_id, reason, channel_id, duration)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(userId, moderatorId, reason || null, channelId || null, duration);
    return db.prepare('SELECT * FROM jail_records WHERE id = ?').get(result.lastInsertRowid);
  },

  unjail(db, recordId, unjailedBy) {
    db.prepare(`
      UPDATE jail_records SET active = 0, unjailed_at = unixepoch(), unjailed_by = ? WHERE id = ?
    `).run(unjailedBy, recordId);
  },

  unjailActiveByUser(db, userId, unjailedBy) {
    db.prepare(`
      UPDATE jail_records SET active = 0, unjailed_at = unixepoch(), unjailed_by = ? 
      WHERE user_id = ? AND active = 1
    `).run(unjailedBy, userId);
  },

  getActive(db, userId) {
    return db.prepare('SELECT * FROM jail_records WHERE user_id = ? AND active = 1 ORDER BY jailed_at DESC LIMIT 1').get(userId);
  },

  getActiveAll(db) {
    return db.prepare('SELECT * FROM jail_records WHERE active = 1 ORDER BY jailed_at DESC').all();
  },

  getHistory(db, userId, limit = 10) {
    return db.prepare('SELECT * FROM jail_records WHERE user_id = ? ORDER BY jailed_at DESC LIMIT ?').all(userId, limit);
  },

  getRecord(db, recordId) {
    return db.prepare('SELECT * FROM jail_records WHERE id = ?').get(recordId);
  },

  getDueForRelease(db) {
    return db.prepare(`
      SELECT * FROM jail_records 
      WHERE active = 1 AND duration IS NOT NULL 
      AND (jailed_at + duration) <= unixepoch()
    `).all();
  },

  storeRoles(db, recordId, roleIds) {
    const stmt = db.prepare('INSERT OR IGNORE INTO jail_stored_roles (jail_record_id, role_id) VALUES (?, ?)');
    const transaction = db.transaction((ids) => {
      for (const roleId of ids) stmt.run(recordId, roleId);
    });
    transaction(roleIds);
  },

  getStoredRoles(db, recordId) {
    return db.prepare('SELECT role_id FROM jail_stored_roles WHERE jail_record_id = ?').all(recordId).map(r => r.role_id);
  },

  getStats(db) {
    const total = db.prepare('SELECT COUNT(*) as c FROM jail_records').get().c;
    const active = db.prepare('SELECT COUNT(*) as c FROM jail_records WHERE active = 1').get().c;
    const today = db.prepare("SELECT COUNT(*) as c FROM jail_records WHERE date(jailed_at, 'unixepoch') = date('now')").get().c;
    const released = db.prepare('SELECT COUNT(*) as c FROM jail_records WHERE active = 0 AND date(unjailed_at, \'unixepoch\') = date(\'now\')').get().c;
    return { total, active, today, released };
  },

  getRecent(db, limit = 20) {
    return db.prepare('SELECT * FROM jail_records ORDER BY jailed_at DESC LIMIT ?').all(limit);
  },
};
