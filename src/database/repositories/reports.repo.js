/**
 * Reports repository — CRUD operations for problem reports.
 */
export const ReportsRepo = {
  create(db, userId, problem) {
    const stmt = db.prepare(
      'INSERT INTO reports (user_id, problem) VALUES (?, ?)'
    );
    const result = stmt.run(userId, problem);
    return this.getById(db, result.lastInsertRowid);
  },

  updateStatus(db, reportId, status, moderatorId = null) {
    db.prepare(
      'UPDATE reports SET status = ?, moderator_id = ? WHERE id = ?'
    ).run(status, moderatorId, reportId);
    return this.getById(db, reportId);
  },

  getById(db, reportId) {
    return db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
  },
};
