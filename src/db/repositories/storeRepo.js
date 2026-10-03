const { getDb } = require('../connection');

function findAll() {
  const db = getDb();
  return db.prepare('SELECT * FROM stores ORDER BY store_id').all();
}

function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM stores WHERE store_id = ?').get(id);
}

module.exports = {
  findAll,
  findById
};
