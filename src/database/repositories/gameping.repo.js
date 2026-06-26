/**
 * GamePing alias repository.
 */
export const GamepingRepo = {
  getAlias(db, alias) {
    return db.prepare('SELECT * FROM gameping_aliases WHERE alias = ?').get(alias);
  },

  addAlias(db, alias, roleId, requiredRoleId) {
    db.prepare(
      'INSERT INTO gameping_aliases (alias, role_id, required_role_id) VALUES (?, ?, ?)'
    ).run(alias, roleId, requiredRoleId || null);
    return this.getAlias(db, alias);
  },

  removeAlias(db, alias) {
    const result = db.prepare('DELETE FROM gameping_aliases WHERE alias = ?').run(alias);
    return result.changes > 0;
  },

  editAlias(db, alias, field, value) {
    const allowed = ['role_id', 'required_role_id'];
    if (!allowed.includes(field)) {
      throw new Error(`Invalid field: ${field}. Allowed: ${allowed.join(', ')}`);
    }
    db.prepare(`UPDATE gameping_aliases SET ${field} = ? WHERE alias = ?`).run(value, alias);
    return this.getAlias(db, alias);
  },

  listAliases(db) {
    return db.prepare('SELECT * FROM gameping_aliases ORDER BY alias').all();
  },
};
