/**
 * Repository module for Booster Custom Roles database operations.
 */
export const BoosterRepo = {
  create(db, userId, roleId) {
    db.prepare(
      'INSERT OR REPLACE INTO booster_roles (user_id, role_id) VALUES (?, ?)'
    ).run(userId, roleId);
    return this.get(db, userId);
  },

  get(db, userId) {
    return db.prepare('SELECT * FROM booster_roles WHERE user_id = ?').get(userId);
  },

  delete(db, userId) {
    const result = db.prepare('DELETE FROM booster_roles WHERE user_id = ?').run(userId);
    return result.changes > 0;
  },

  listAll(db) {
    return db.prepare('SELECT * FROM booster_roles ORDER BY created_at ASC').all();
  },
};
