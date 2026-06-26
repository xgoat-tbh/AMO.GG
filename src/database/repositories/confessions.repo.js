/**
 * Confessions repository.
 */
export const ConfessionsRepo = {
  create(db, authorId, content, type) {
    const stmt = db.prepare(
      'INSERT INTO confessions (author_id, content, type) VALUES (?, ?, ?)'
    );
    const result = stmt.run(authorId, content, type);
    return this.getById(db, result.lastInsertRowid);
  },

  setMessageId(db, id, messageId) {
    db.prepare('UPDATE confessions SET message_id = ? WHERE id = ?').run(messageId, id);
  },

  getById(db, id) {
    return db.prepare('SELECT * FROM confessions WHERE id = ?').get(id);
  },

  getByMessageId(db, messageId) {
    return db.prepare('SELECT * FROM confessions WHERE message_id = ?').get(messageId);
  },

  count(db) {
    return db.prepare('SELECT COUNT(*) as count FROM confessions').get().count;
  },
};
