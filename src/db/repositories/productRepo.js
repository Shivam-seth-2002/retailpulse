const { getDb } = require('../connection');

function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM products WHERE product_id = ?').get(id);
}

function findBySku(sku) {
  const db = getDb();
  return db.prepare('SELECT * FROM products WHERE sku = ?').get(sku);
}

function findAll({ category, limit = 50, cursor = 0 }) {
  const db = getDb();
  
  if (category) {
    return db.prepare(`
      SELECT * FROM products 
      WHERE category = ? AND product_id > ? 
      ORDER BY product_id ASC LIMIT ?
    `).all(category, cursor, limit);
  }
  
  return db.prepare(`
    SELECT * FROM products 
    WHERE product_id > ? 
    ORDER BY product_id ASC LIMIT ?
  `).all(cursor, limit);
}

function create({ sku, name, category, unit_price }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO products (sku, name, category, unit_price)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(sku, name, category, unit_price);
  return findById(info.lastInsertRowid);
}

function update(id, { category, unit_price }) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE products
    SET category = COALESCE(?, category),
        unit_price = COALESCE(?, unit_price)
    WHERE product_id = ?
  `);
  stmt.run(category, unit_price, id);
  return findById(id);
}

module.exports = {
  findById,
  findBySku,
  findAll,
  create,
  update
};
