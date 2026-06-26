/**
 * Repository module for Giveaway database operations.
 */
export const GiveawaysRepo = {
  create(db, { prize, hostId, channelId, endTime, winnerCount }) {
    const result = db.prepare(
      `INSERT INTO giveaways (prize, host_id, channel_id, end_time, winner_count)
       VALUES (?, ?, ?, ?, ?)`
    ).run(prize, hostId, channelId, endTime, winnerCount || 1);
    
    return this.get(db, result.lastInsertRowid);
  },

  get(db, id) {
    return db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
  },

  getByMessageId(db, messageId) {
    return db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
  },

  update(db, id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return this.get(db, id);

    const sets = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => fields[k]);
    values.push(id);

    db.prepare(`UPDATE giveaways SET ${sets} WHERE id = ?`).run(...values);
    return this.get(db, id);
  },

  updateStatus(db, id, status) {
    return this.update(db, id, { status });
  },

  listActive(db) {
    return db.prepare("SELECT * FROM giveaways WHERE status = 'active'").all();
  },

  // ── Entry Operations ─────────────────────────────────────────

  addEntry(db, giveawayId, userId) {
    // Using INSERT OR IGNORE because of primary key (giveaway_id, user_id)
    db.prepare(
      'INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)'
    ).run(giveawayId, userId);
  },

  hasEntered(db, giveawayId, userId) {
    const row = db.prepare(
      'SELECT 1 FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?'
    ).get(giveawayId, userId);
    return !!row;
  },

  getEntriesCount(db, giveawayId) {
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM giveaway_entries WHERE giveaway_id = ?'
    ).get(giveawayId);
    return row ? row.count : 0;
  },

  getEntries(db, giveawayId) {
    return db.prepare(
      'SELECT user_id FROM giveaway_entries WHERE giveaway_id = ? ORDER BY joined_at ASC'
    ).all(giveawayId);
  },
};
