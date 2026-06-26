/**
 * Voice lockdown state repository.
 */
export const VoiceRepo = {
  saveState(db, channelId, userId, wasMuted, wasDeafened) {
    db.prepare(
      `INSERT OR REPLACE INTO voice_lockdown_state
       (channel_id, user_id, was_muted, was_deafened)
       VALUES (?, ?, ?, ?)`
    ).run(channelId, userId, wasMuted ? 1 : 0, wasDeafened ? 1 : 0);
  },

  saveBulkState(db, channelId, states) {
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO voice_lockdown_state
       (channel_id, user_id, was_muted, was_deafened)
       VALUES (?, ?, ?, ?)`
    );
    db.exec('BEGIN');
    try {
      for (const s of states) {
        stmt.run(channelId, s.userId, s.wasMuted ? 1 : 0, s.wasDeafened ? 1 : 0);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  },

  getStates(db, channelId) {
    return db.prepare(
      'SELECT * FROM voice_lockdown_state WHERE channel_id = ?'
    ).all(channelId);
  },

  clearStates(db, channelId) {
    db.prepare('DELETE FROM voice_lockdown_state WHERE channel_id = ?').run(channelId);
  },

  hasLockdown(db, channelId) {
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM voice_lockdown_state WHERE channel_id = ?'
    ).get(channelId);
    return row.count > 0;
  },
};
