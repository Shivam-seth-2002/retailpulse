/**
 * Database connection (singleton).
 *
 * better-sqlite3 is synchronous and very fast, and one connection per process
 * is the recommended pattern. So we open the database once, lazily, and every
 * repository calls getDb() to share that same connection.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');
const logger = require('../utils/logger');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db = null;

/** Returns the shared connection, opening it on first use. */
function getDb() {
  if (db) return db;

  // Make sure the folder for the .db file exists (not needed for :memory:)
  if (config.dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  }

  db = new Database(config.dbPath);

  // WAL = Write-Ahead Logging: readers don't block the writer and vice versa.
  db.pragma('journal_mode = WAL');
  // SQLite does NOT enforce foreign keys unless you turn them on per connection.
  db.pragma('foreign_keys = ON');

  logger.debug('Database opened', { path: config.dbPath });
  return db;
}

/** Runs schema.sql (safe to run many times because of IF NOT EXISTS). */
function initSchema(database = getDb()) {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  database.exec(sql);
}

/** Simple health check used by GET /health. */
function isConnected() {
  try {
    return getDb().prepare('SELECT 1 AS ok').get().ok === 1;
  } catch {
    return false;
  }
}

/** Closes the connection (used by graceful shutdown and tests). */
function closeDb() {
  if (db) {
    db.close();
    db = null;
    logger.debug('Database closed');
  }
}

module.exports = { getDb, initSchema, isConnected, closeDb };
