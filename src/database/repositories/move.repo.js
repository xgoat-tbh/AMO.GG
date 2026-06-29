export const MoveRepo = {
  create(db, targetId, moderatorId, fromChannelId, toChannelId, expiresAt) {
    const stmt = db.prepare(`
      INSERT INTO move_requests (target_id, moderator_id, from_channel_id, to_channel_id, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(targetId, moderatorId, fromChannelId || null, toChannelId, expiresAt);
    return { id: result.lastInsertRowid };
  },

  getPending(db, targetId) {
    return db.prepare("SELECT * FROM move_requests WHERE target_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1").get(targetId);
  },

  updateStatus(db, id, status) {
    db.prepare('UPDATE move_requests SET status = ? WHERE id = ?').run(status, id);
  },

  expireOld(db) {
    db.prepare("UPDATE move_requests SET status = 'expired' WHERE status = 'pending' AND expires_at < unixepoch()").run();
  },
};
