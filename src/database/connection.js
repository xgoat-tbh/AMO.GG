import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../helpers/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db = null;

export function getDb() {
  if (db) return db;

  const dbPath = join(__dirname, '..', '..', 'amo.db');
  db = new DatabaseSync(dbPath);

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');

  // Run main schema (CREATE TABLE IF NOT EXISTS)
  const mainSchema = schema.split('\n').filter(line => !line.trim().startsWith('ALTER TABLE')).join('\n');
  db.exec(mainSchema);

  // Run migrations (ALTER TABLE) individually, ignore errors if column exists
  const alterLines = schema.split('\n').filter(line => line.trim().startsWith('ALTER TABLE'));
  for (const line of alterLines) {
    try {
      db.exec(line.trim());
    } catch {
      // Column already exists, safe to ignore
    }
  }

  logger.info('DB', 'Database initialized');
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
    logger.info('DB', 'Database closed');
  }
}
