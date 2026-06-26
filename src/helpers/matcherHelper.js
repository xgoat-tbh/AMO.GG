import Fuse from 'fuse.js';

/**
 * 5-tier fuzzy role matching.
 *
 * Priority:
 *   1. Exact match (case-insensitive)
 *   2. Starts with query
 *   3. Word prefix — each query word matches start of a role-name word
 *   4. Word contains — each query word is found inside a role-name word
 *   5. Fuse.js fuzzy fallback
 *
 * Examples:
 *   "mod"       → "Moderator"
 *   "jr mod"    → "Junior Moderator"
 *   "sen mod"   → "Senior Moderator"
 *   "c acc"     → "Casino Access"
 */

/**
 * Find a single role by fuzzy query.
 * @param {Guild} guild
 * @param {string} query
 * @returns {{ role: Role, tier: number } | null}
 */
export function findRole(guild, query) {
  const q = query.trim();
  if (!q) return null;

  const roles = [...guild.roles.cache.values()].filter(
    r => r.id !== guild.id && r.managed === false
  );

  // Tier 1 — Exact match
  const exact = roles.find(r => r.name.toLowerCase() === q.toLowerCase());
  if (exact) return { role: exact, tier: 1 };

  // Tier 2 — Starts with
  const startsWith = roles.find(r =>
    r.name.toLowerCase().startsWith(q.toLowerCase())
  );
  if (startsWith) return { role: startsWith, tier: 2 };

  // Tier 3 — Word prefix
  const queryWords = q.toLowerCase().split(/\s+/);
  const wordPrefix = roles.find(r => {
    const roleWords = r.name.toLowerCase().split(/\s+/);
    return queryWords.every(qw =>
      roleWords.some(rw => rw.startsWith(qw))
    );
  });
  if (wordPrefix) return { role: wordPrefix, tier: 3 };

  // Tier 4 — Word contains
  const wordContains = roles.find(r => {
    const roleWords = r.name.toLowerCase().split(/\s+/);
    return queryWords.every(qw =>
      roleWords.some(rw => rw.includes(qw))
    );
  });
  if (wordContains) return { role: wordContains, tier: 4 };

  // Tier 5 — Fuse.js
  const fuse = new Fuse(roles, {
    keys: ['name'],
    threshold: 0.4,
    includeScore: true,
  });
  const fuseResults = fuse.search(q);
  if (fuseResults.length > 0) {
    return { role: fuseResults[0].item, tier: 5 };
  }

  return null;
}

/**
 * Find multiple roles from a comma-separated string.
 * @param {Guild} guild
 * @param {string} queryString  e.g. "VIP, Event, Staff"
 * @returns {Array<{ role: Role, tier: number, query: string } | { role: null, query: string }>}
 */
export function findRoles(guild, queryString) {
  const queries = queryString.split(',').map(s => s.trim()).filter(Boolean);
  return queries.map(query => {
    const result = findRole(guild, query);
    if (result) return { ...result, query };
    return { role: null, tier: null, query };
  });
}

/**
 * Get top N fuzzy matches for ambiguity resolution.
 * @param {Guild} guild
 * @param {string} query
 * @param {number} limit
 * @returns {Array<{ role: Role, score: number }>}
 */
export function findRoleCandidates(guild, query, limit = 5) {
  const q = query.trim();
  if (!q) return [];

  const roles = [...guild.roles.cache.values()].filter(
    r => r.id !== guild.id && r.managed === false
  );

  const fuse = new Fuse(roles, {
    keys: ['name'],
    threshold: 0.6,
    includeScore: true,
  });

  return fuse.search(q, { limit }).map(r => ({
    role: r.item,
    score: r.score,
  }));
}
