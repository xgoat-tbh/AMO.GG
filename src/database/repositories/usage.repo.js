export const UsageRepo = {
  record(db, commandName, userId, guildId, duration, isError) {
    db.prepare(`
      INSERT INTO command_usage (command_name, user_id, guild_id, duration, error)
      VALUES (?, ?, ?, ?, ?)
    `).run(commandName, userId, guildId, duration, isError ? 1 : 0);
  },

  getTopCommands(db, guildId, limit = 10) {
    return db.prepare(`
      SELECT command_name, COUNT(*) as count, AVG(duration) as avg_duration,
             SUM(error) as errors
      FROM command_usage
      WHERE guild_id = ?
      GROUP BY command_name
      ORDER BY count DESC LIMIT ?
    `).all(guildId, limit);
  },

  getTotalUsage(db, guildId) {
    return db.prepare(`
      SELECT COUNT(*) as total, SUM(error) as errors
      FROM command_usage WHERE guild_id = ?
    `).get(guildId);
  },

  getUsageToday(db, guildId) {
    return db.prepare(`
      SELECT COUNT(*) as count
      FROM command_usage
      WHERE guild_id = ? AND date(used_at, 'unixepoch') = date('now')
    `).get(guildId);
  },

  getTopUsers(db, guildId, limit = 10) {
    return db.prepare(`
      SELECT user_id, COUNT(*) as count
      FROM command_usage
      WHERE guild_id = ?
      GROUP BY user_id
      ORDER BY count DESC LIMIT ?
    `).all(guildId, limit);
  },

  pruneOlderThan(db, days) {
    const cutoff = Math.floor(Date.now() / 1000) - (days * 86400);
    db.prepare('DELETE FROM command_usage WHERE used_at < ?').run(cutoff);
  },
};
