/**
 * Temp VCs repository — CRUD operations for temporary voice channels.
 */
export const TempVcsRepo = {
  create(db, channelId, creatorId, game, name, limit, parentTextChannelId = null, parentMessageId = null) {
    const stmt = db.prepare(
      'INSERT INTO temp_vcs (channel_id, creator_id, game, name, user_limit, parent_text_channel_id, parent_message_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(channelId, creatorId, game, name, limit, parentTextChannelId, parentMessageId);
    return this.get(db, channelId);
  },

  get(db, channelId) {
    return db.prepare('SELECT * FROM temp_vcs WHERE channel_id = ?').get(channelId);
  },

  delete(db, channelId) {
    return db.prepare('DELETE FROM temp_vcs WHERE channel_id = ?').run(channelId);
  },

  updateName(db, channelId, name) {
    db.prepare('UPDATE temp_vcs SET name = ? WHERE channel_id = ?').run(name, channelId);
    return this.get(db, channelId);
  },

  updateLimit(db, channelId, limit) {
    db.prepare('UPDATE temp_vcs SET user_limit = ? WHERE channel_id = ?').run(limit, channelId);
    return this.get(db, channelId);
  },

  updateGame(db, channelId, game) {
    db.prepare('UPDATE temp_vcs SET game = ? WHERE channel_id = ?').run(game, channelId);
    return this.get(db, channelId);
  },

  clear(db) {
    return db.prepare('DELETE FROM temp_vcs').run();
  },
};
