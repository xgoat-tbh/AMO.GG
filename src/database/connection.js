import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../helpers/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db = null;

/**
 * Returns the singleton database instance.
 * Initializes on first call: creates file, enables WAL + FK, runs schema.
 */
export function getDb() {
  if (db) return db;

  const dbPath = join(__dirname, '..', '..', 'amo.db');
  db = new DatabaseSync(dbPath);

  // Performance & integrity
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');

  // Run schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  logger.info('DB', 'Database initialized');
  return db;


}

/**
 * close the database connection.
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
    logger.info('DB', 'Database closed');
  }
}
