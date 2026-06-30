export const BumpRepo = {
  getConfig(db, guildId) {
    return db.prepare('SELECT * FROM bump_config WHERE guild_id = ?').get(guildId);
  },

  setConfig(db, guildId, channelId, roleId = null) {
    db.prepare(`
      INSERT INTO bump_config (guild_id, channel_id, role_id)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, role_id = excluded.role_id
    `).run(guildId, channelId, roleId);
  },

  updateLastBump(db, guildId) {
    db.prepare('UPDATE bump_config SET last_bump_time = unixepoch() WHERE guild_id = ?').run(guildId);
  },

  setEnabled(db, guildId, enabled) {
    db.prepare('UPDATE bump_config SET enabled = ? WHERE guild_id = ?').run(enabled ? 1 : 0, guildId);
  },

  getAllEnabled(db) {
    return db.prepare('SELECT * FROM bump_config WHERE enabled = 1').all();
  },

  removeConfig(db, guildId) {
    db.prepare('DELETE FROM bump_config WHERE guild_id = ?').run(guildId);
  },
};
