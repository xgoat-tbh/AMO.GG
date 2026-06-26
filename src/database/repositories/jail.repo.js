/**
 * Jail system repository — jail/unjail + role backup/restore + history.
 */
export const JailRepo = {
  jail(db, userId, moderatorId, reason) {
    const stmt = db.prepare(
      'INSERT INTO jail_records (user_id, moderator_id, reason) VALUES (?, ?, ?)'
    );
    const result = stmt.run(userId, moderatorId, reason || null);
    return { id: result.lastInsertRowid, user_id: userId, moderator_id: moderatorId, reason };
  },

  unjail(db, userId, unjailedBy) {
    const record = this.getActive(db, userId);
    if (!record) return null;

    db.prepare(
      'UPDATE jail_records SET active = 0, unjailed_at = unixepoch(), unjailed_by = ? WHERE id = ?'
    ).run(unjailedBy, record.id);

    return { ...record, unjailed_by: unjailedBy };
  },

  getActive(db, userId) {
    return db.prepare(
      'SELECT * FROM jail_records WHERE user_id = ? AND active = 1 ORDER BY jailed_at DESC LIMIT 1'
    ).get(userId);
  },

  getHistory(db, userId) {
    return db.prepare(
      'SELECT * FROM jail_records WHERE user_id = ? ORDER BY jailed_at DESC'
    ).all(userId);
  },

  storeRoles(db, recordId, roleIds) {
    const stmt = db.prepare(
      'INSERT INTO jail_stored_roles (jail_record_id, role_id) VALUES (?, ?)'
    );
    db.exec('BEGIN');
    try {
      for (const roleId of roleIds) {
        stmt.run(recordId, roleId);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  },

  getStoredRoles(db, recordId) {
    return db.prepare(
      'SELECT role_id FROM jail_stored_roles WHERE jail_record_id = ?'
    ).all(recordId).map(r => r.role_id);
  },
};
