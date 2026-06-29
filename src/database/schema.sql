-- ============================================================
-- Amo.GG Database Schema
-- ============================================================

-- Suggestions
CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id TEXT NOT NULL,
    message_id TEXT UNIQUE,
    thread_id TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS suggestion_votes (
    suggestion_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK(vote_type IN ('yes', 'no')),
    PRIMARY KEY (suggestion_id, user_id),
    FOREIGN KEY (suggestion_id) REFERENCES suggestions(id) ON DELETE CASCADE
);

-- Confessions
CREATE TABLE IF NOT EXISTS confessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id TEXT NOT NULL,
    message_id TEXT UNIQUE,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('known', 'anonymous')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- GamePing Aliases
CREATE TABLE IF NOT EXISTS gameping_aliases (
    alias TEXT PRIMARY KEY COLLATE NOCASE,
    role_id TEXT NOT NULL,
    required_role_id TEXT
);

-- Jail System
CREATE TABLE IF NOT EXISTS jail_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT,
    duration INTEGER,
    channel_id TEXT,
    jailed_at INTEGER NOT NULL DEFAULT (unixepoch()),
    unjailed_at INTEGER,
    unjailed_by TEXT,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS jail_stored_roles (
    jail_record_id INTEGER NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (jail_record_id, role_id),
    FOREIGN KEY (jail_record_id) REFERENCES jail_records(id) ON DELETE CASCADE
);

-- Voice Lockdown State
CREATE TABLE IF NOT EXISTS voice_lockdown_state (
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    was_muted INTEGER NOT NULL DEFAULT 0,
    was_deafened INTEGER NOT NULL DEFAULT 0,
    locked_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (channel_id, user_id)
);

-- Role Operation Audit Log
CREATE TABLE IF NOT EXISTS role_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    moderator_id TEXT NOT NULL,
    target_user_id TEXT,
    role_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('add', 'remove')),
    command TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suggestions_author ON suggestions(author_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_confessions_author ON confessions(author_id);
CREATE INDEX IF NOT EXISTS idx_jail_records_user ON jail_records(user_id);
CREATE INDEX IF NOT EXISTS idx_jail_records_active ON jail_records(active);
CREATE INDEX IF NOT EXISTS idx_role_audit_moderator ON role_audit_log(moderator_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_target ON role_audit_log(target_user_id);

-- Runtime Configuration
CREATE TABLE IF NOT EXISTS bot_config (
    key TEXT PRIMARY KEY,
    value TEXT
);


-- Temporary VCs
CREATE TABLE IF NOT EXISTS temp_vcs (
    channel_id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    game TEXT,
    name TEXT NOT NULL,
    user_limit INTEGER NOT NULL,
    parent_text_channel_id TEXT,
    parent_message_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Giveaway System
CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prize TEXT NOT NULL,
    host_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT UNIQUE,
    end_time INTEGER NOT NULL,
    winner_count INTEGER NOT NULL DEFAULT 1,
    winners TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'ended')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS giveaway_entries (
    giveaway_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (giveaway_id, user_id),
    FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
);


-- Booster Custom Roles System
CREATE TABLE IF NOT EXISTS booster_roles (
    user_id TEXT PRIMARY KEY,
    role_id TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Global Blacklist System
CREATE TABLE IF NOT EXISTS blacklist (
    user_id TEXT PRIMARY KEY,
    blacklisted_by TEXT NOT NULL,
    blacklisted_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- Moderation Cases System
-- ============================================================
CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT UNIQUE NOT NULL,
    guild_id TEXT NOT NULL,
    action TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    reason TEXT,
    duration INTEGER,
    channel_id TEXT,
    message_link TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cases_target ON cases(target_id);
CREATE INDEX IF NOT EXISTS idx_cases_moderator ON cases(moderator_id);
CREATE INDEX IF NOT EXISTS idx_cases_guild ON cases(guild_id);

-- ============================================================
-- XP / Leveling System
-- ============================================================
CREATE TABLE IF NOT EXISTS xp (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    voice_xp INTEGER NOT NULL DEFAULT 0,
    last_message INTEGER,
    last_voice INTEGER,
    joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS xp_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    level INTEGER NOT NULL,
    role_id TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(guild_id, level)
);

CREATE TABLE IF NOT EXISTS xp_config (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    rate INTEGER NOT NULL DEFAULT 1,
    message_cooldown INTEGER NOT NULL DEFAULT 60,
    voice_interval INTEGER NOT NULL DEFAULT 60,
    xp_min INTEGER NOT NULL DEFAULT 15,
    xp_max INTEGER NOT NULL DEFAULT 25,
    announcement_channel TEXT
);

CREATE INDEX IF NOT EXISTS idx_xp_guild ON xp(guild_id, xp DESC);
CREATE INDEX IF NOT EXISTS idx_xp_rewards_guild ON xp_rewards(guild_id, level);

-- ============================================================
-- Anti-Promotion System
-- ============================================================
CREATE TABLE IF NOT EXISTS promotion_config (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    strict_mode INTEGER NOT NULL DEFAULT 1,
    log_channel TEXT,
    auto_delete INTEGER NOT NULL DEFAULT 1,
    notify_user INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS promotion_whitelist (
    guild_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    added_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, domain)
);

CREATE TABLE IF NOT EXISTS promotion_blacklist (
    guild_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    added_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, domain)
);

-- Default game invite exceptions
INSERT OR IGNORE INTO promotion_whitelist (guild_id, domain, added_by) VALUES
    ('_default', 'richup.io', 'system'),
    ('_default', 'codenames.game', 'system'),
    ('_default', 'skribbl.io', 'system'),
    ('_default', 'smashkarts.io', 'system'),
    ('_default', 'gartic.io', 'system'),
    ('_default', 'chess.com', 'system'),
    ('_default', 'lichess.org', 'system'),
    ('_default', 'boardgamearena.com', 'system'),
    ('_default', 'jackbox.tv', 'system');

-- ============================================================
-- Move Request System
-- ============================================================
CREATE TABLE IF NOT EXISTS move_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    from_channel_id TEXT,
    to_channel_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_move_requests_target ON move_requests(target_id, status);

-- ============================================================
-- Migrations for existing databases (safe to re-run)
-- ============================================================
ALTER TABLE jail_records ADD COLUMN duration INTEGER;
ALTER TABLE jail_records ADD COLUMN channel_id TEXT;


