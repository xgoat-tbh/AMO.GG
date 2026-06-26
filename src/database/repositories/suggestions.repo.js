/**
 * Suggestions repository — CRUD + vote toggle logic.
 */
export const SuggestionsRepo = {
  create(db, authorId, content) {
    const stmt = db.prepare(
      'INSERT INTO suggestions (author_id, content) VALUES (?, ?)'
    );
    const result = stmt.run(authorId, content);
    return this.getById(db, result.lastInsertRowid);
  },

  setMessageId(db, id, messageId) {
    db.prepare('UPDATE suggestions SET message_id = ? WHERE id = ?').run(messageId, id);
  },

  setThreadId(db, id, threadId) {
    db.prepare('UPDATE suggestions SET thread_id = ? WHERE id = ?').run(threadId, id);
  },

  updateStatus(db, id, status) {
    db.prepare('UPDATE suggestions SET status = ? WHERE id = ?').run(status, id);
  },

  getById(db, id) {
    return db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id);
  },

  getByMessageId(db, messageId) {
    return db.prepare('SELECT * FROM suggestions WHERE message_id = ?').get(messageId);
  },

  /**
   * Toggle vote. Returns the new state: 'added', 'switched', or 'removed'.
   */
  vote(db, suggestionId, userId, voteType) {
    const existing = db.prepare(
      'SELECT vote_type FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?'
    ).get(suggestionId, userId);

    if (!existing) {
      db.prepare(
        'INSERT INTO suggestion_votes (suggestion_id, user_id, vote_type) VALUES (?, ?, ?)'
      ).run(suggestionId, userId, voteType);
      return 'added';
    }

    if (existing.vote_type === voteType) {
      db.prepare(
        'DELETE FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?'
      ).run(suggestionId, userId);
      return 'removed';
    }

    db.prepare(
      'UPDATE suggestion_votes SET vote_type = ? WHERE suggestion_id = ? AND user_id = ?'
    ).run(voteType, suggestionId, userId);
    return 'switched';
  },

  removeVote(db, suggestionId, userId) {
    db.prepare(
      'DELETE FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?'
    ).run(suggestionId, userId);
  },

  getVotes(db, suggestionId) {
    return db.prepare(
      'SELECT * FROM suggestion_votes WHERE suggestion_id = ?'
    ).all(suggestionId);
  },

  getVoteCounts(db, suggestionId) {
    const rows = db.prepare(
      `SELECT vote_type, COUNT(*) as count
       FROM suggestion_votes
       WHERE suggestion_id = ?
       GROUP BY vote_type`
    ).all(suggestionId);

    const counts = { yes: 0, no: 0 };
    for (const row of rows) {
      counts[row.vote_type] = row.count;
    }
    return counts;
  },
};
