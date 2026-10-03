const { getDb } = require('../connection');

function findByStore(storeId) {
  const db = getDb();
  return db.prepare(`
    SELECT i.product_id, p.name, p.sku, i.quantity, i.reorder_level, i.updated_at
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    WHERE i.store_id = ?
  `).all(storeId);
}

function upsert(storeId, productId, quantity, reorder_level = 10) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO inventory (store_id, product_id, quantity, reorder_level, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(store_id, product_id) DO UPDATE SET
      quantity = excluded.quantity,
      reorder_level = excluded.reorder_level,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(storeId, productId, quantity, reorder_level);
  
  return db.prepare('SELECT * FROM inventory WHERE store_id = ? AND product_id = ?').get(storeId, productId);
}

module.exports = {
  findByStore,
  upsert
};
