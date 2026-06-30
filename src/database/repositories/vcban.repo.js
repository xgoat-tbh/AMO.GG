export const VcBanRepo = {
  add(db, guildId, userId, channelId, moderatorId, reason) {
    const cid = channelId || null;
    db.prepare(`
      INSERT OR REPLACE INTO vc_bans (guild_id, user_id, channel_id, moderator_id, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(guildId, userId, cid, moderatorId, reason || null);
    if (cid) {
      return db.prepare('SELECT * FROM vc_bans WHERE guild_id = ? AND user_id = ? AND channel_id = ?').get(guildId, userId, cid);
    }
    return db.prepare('SELECT * FROM vc_bans WHERE guild_id = ? AND user_id = ? AND channel_id IS NULL').get(guildId, userId);
  },

  remove(db, guildId, userId, channelId) {
    if (channelId) {
      db.prepare('DELETE FROM vc_bans WHERE guild_id = ? AND user_id = ? AND channel_id = ?').run(guildId, userId, channelId);
    } else {
      db.prepare('DELETE FROM vc_bans WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
    }
  },

  getByUser(db, guildId, userId) {
    return db.prepare('SELECT * FROM vc_bans WHERE guild_id = ? AND user_id = ?').all(guildId, userId);
  },

  getByChannel(db, guildId, channelId) {
    return db.prepare('SELECT * FROM vc_bans WHERE guild_id = ? AND channel_id = ?').all(guildId, channelId);
  },

  getAll(db, guildId) {
    return db.prepare('SELECT * FROM vc_bans WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
  },

  isBanned(db, guildId, userId, channelId) {
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM vc_bans
      WHERE guild_id = ? AND user_id = ? AND (channel_id = ? OR channel_id IS NULL)
    `).get(guildId, userId, channelId);
    return row.count > 0;
  },

  getBannedUserIds(db, guildId) {
    return db.prepare('SELECT DISTINCT user_id FROM vc_bans WHERE guild_id = ?').all(guildId).map(r => r.user_id);
  },
};
