/**
 * npm run db:init
 *
 * Creates the SQLite database file (if missing) and runs schema.sql.
 * Safe to run more than once - existing tables and data are kept.
 */
const config = require('../src/config');
const { getDb, initSchema, closeDb } = require('../src/db/connection');

try {
  const db = getDb();
  initSchema(db);

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => row.name);

  console.log(`Database ready at ${config.dbPath}`);
  console.log(`Tables: ${tables.join(', ')}`);
  closeDb();
} catch (err) {
  console.error('Failed to initialise database:', err.message);
  process.exit(1);
}
