/**
 * Blacklist repository — handles global user blacklist persistence.
 */
export const BlacklistRepo = {
  add(db, userId, executorId) {
    db.prepare(
      'INSERT INTO blacklist (user_id, blacklisted_by) VALUES (?, ?) ON CONFLICT(user_id) DO NOTHING'
    ).run(userId, executorId);
  },

  remove(db, userId) {
    db.prepare('DELETE FROM blacklist WHERE user_id = ?').run(userId);
  },

  getAll(db) {
    const rows = db.prepare('SELECT user_id FROM blacklist').all();
    return rows.map(r => r.user_id);
  },
};
