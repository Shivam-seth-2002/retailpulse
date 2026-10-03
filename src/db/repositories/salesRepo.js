const { getDb } = require('../connection');

function find({ from, to, storeId, limit = 50, cursor = 0 }) {
  const db = getDb();
  const conditions = ['sale_id > ?'];
  const params = [cursor];
  
  if (from) {
    conditions.push('sold_at >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('sold_at <= ?');
    params.push(to);
  }
  if (storeId) {
    conditions.push('store_id = ?');
    params.push(storeId);
  }
  
  params.push(limit);
  
  const sql = `
    SELECT * FROM sales
    WHERE ${conditions.join(' AND ')}
    ORDER BY sale_id ASC LIMIT ?
  `;
  
  return db.prepare(sql).all(...params);
}

function bulkInsert(sales) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sales (store_id, product_id, quantity, amount, sold_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((items) => {
    for (const item of items) {
      stmt.run(item.store_id, item.product_id, item.quantity, item.amount, item.sold_at);
    }
  });
  
  insertMany(sales);
}

module.exports = {
  find,
  bulkInsert
};
