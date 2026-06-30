export const QueueRepo = {
  join(db, guildId, targetChannelId, userId) {
    try {
      const result = db.prepare(`
        INSERT INTO voice_queue (guild_id, target_channel_id, user_id)
        VALUES (?, ?, ?)
      `).run(guildId, targetChannelId, userId);
      return db.prepare('SELECT * FROM voice_queue WHERE id = ?').get(result.lastInsertRowid);
    } catch {
      return null;
    }
  },

  leave(db, guildId, targetChannelId, userId) {
    db.prepare(`
      UPDATE voice_queue SET status = 'removed'
      WHERE guild_id = ? AND target_channel_id = ? AND user_id = ? AND status = 'waiting'
    `).run(guildId, targetChannelId, userId);
  },

  getQueue(db, targetChannelId) {
    return db.prepare(`
      SELECT * FROM voice_queue
      WHERE target_channel_id = ? AND status = 'waiting'
      ORDER BY joined_queue_at ASC
    `).all(targetChannelId);
  },

  getPosition(db, targetChannelId, userId) {
    const queue = this.getQueue(db, targetChannelId);
    return queue.findIndex(e => e.user_id === userId) + 1;
  },

  getTotalWaiting(db, targetChannelId) {
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM voice_queue
      WHERE target_channel_id = ? AND status = 'waiting'
    `).get(targetChannelId);
    return row.count;
  },

  markJoined(db, id) {
    db.prepare("UPDATE voice_queue SET status = 'joined' WHERE id = ?").run(id);
  },

  isInQueue(db, userId, targetChannelId) {
    const row = db.prepare(`
      SELECT id FROM voice_queue
      WHERE user_id = ? AND target_channel_id = ? AND status = 'waiting'
    `).get(userId, targetChannelId);
    return !!row;
  },

  getActiveQueuesForUser(db, userId) {
    return db.prepare(`
      SELECT * FROM voice_queue
      WHERE user_id = ? AND status = 'waiting'
      ORDER BY joined_queue_at ASC
    `).all(userId);
  },

  clearQueue(db, targetChannelId) {
    db.prepare(`
      UPDATE voice_queue SET status = 'removed'
      WHERE target_channel_id = ? AND status = 'waiting'
    `).run(targetChannelId);
  },

  pruneStale(db, minutes) {
    const cutoff = Math.floor(Date.now() / 1000) - (minutes * 60);
    db.prepare(`
      UPDATE voice_queue SET status = 'removed'
      WHERE status = 'waiting' AND joined_queue_at < ?
    `).run(cutoff);
  },
};
