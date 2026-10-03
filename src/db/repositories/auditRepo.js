const { getDb } = require('../connection');

function create({ api_key_id, method, path, intent, status, duration_ms }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO audit_log (api_key_id, method, path, intent, status, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(api_key_id, method, path, intent || null, status, duration_ms);
}

module.exports = {
  create
};
