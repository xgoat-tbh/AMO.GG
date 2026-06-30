export const AutoResponderRepo = {
  add(db, guildId, trigger, response, matchType, createdBy) {
    db.prepare(`
      INSERT INTO auto_responders (guild_id, trigger, response, match_type, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(guildId, trigger, response, matchType, createdBy);
    return db.prepare('SELECT * FROM auto_responders WHERE id = last_insert_rowid()').get();
  },

  remove(db, id) {
    db.prepare('DELETE FROM auto_responders WHERE id = ?').run(id);
  },

  get(db, id) {
    return db.prepare('SELECT * FROM auto_responders WHERE id = ?').get(id);
  },

  getAll(db, guildId) {
    return db.prepare('SELECT * FROM auto_responders WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
  },

  getEnabled(db, guildId) {
    return db.prepare('SELECT * FROM auto_responders WHERE guild_id = ? AND enabled = 1 ORDER BY created_at ASC').all(guildId);
  },

  toggle(db, id) {
    const row = db.prepare('SELECT enabled FROM auto_responders WHERE id = ?').get(id);
    if (!row) return null;
    const newVal = row.enabled ? 0 : 1;
    db.prepare('UPDATE auto_responders SET enabled = ? WHERE id = ?').run(newVal, id);
    return newVal;
  },

  count(db, guildId) {
    const row = db.prepare('SELECT COUNT(*) as c FROM auto_responders WHERE guild_id = ?').get(guildId);
    return row.c;
  },
};
