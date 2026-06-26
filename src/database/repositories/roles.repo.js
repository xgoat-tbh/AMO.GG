/**
 * Role operation audit log repository.
 */
export const RolesRepo = {
  logAction(db, moderatorId, targetUserId, roleId, action, command) {
    db.prepare(
      `INSERT INTO role_audit_log (moderator_id, target_user_id, role_id, action, command)
       VALUES (?, ?, ?, ?, ?)`
    ).run(moderatorId, targetUserId, roleId, action, command);
  },

  getByTarget(db, targetUserId, limit = 25) {
    return db.prepare(
      'SELECT * FROM role_audit_log WHERE target_user_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(targetUserId, limit);
  },

  getByModerator(db, moderatorId, limit = 25) {
    return db.prepare(
      'SELECT * FROM role_audit_log WHERE moderator_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(moderatorId, limit);
  },
};
