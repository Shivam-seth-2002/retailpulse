const Joi = require('joi');
const { FilterTree } = require('../dataStructures/FilterTree');
const { compileFilter } = require('../filterCompiler');

const fieldMap = new Map([
  ['store_id', { column: 'i.store_id' }],
  ['product_id', { column: 'i.product_id' }],
  ['category', { column: 'p.category' }],
  ['quantity', { column: 'i.quantity' }],
  ['city', { column: 's.city' }]
]);

module.exports = {
  name: 'low_stock',
  description: 'Products below reorder level, optionally filtered',
  schema: Joi.object({
    filters: Joi.object(),
    limit: Joi.number().max(500).default(50)
  }),
  cacheTtlMs: 60_000,
  
  execute: (params, db) => {
    let tree = null;
    if (params.filters) {
      tree = FilterTree.parse(params.filters);
    }
    
    const { whereSql, params: sqlParams } = compileFilter(tree, fieldMap);
    
    const sql = `
      SELECT i.store_id, s.name as store_name, i.product_id, p.name as product_name, p.category, i.quantity, i.reorder_level
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN stores s ON i.store_id = s.store_id
      WHERE i.quantity < i.reorder_level AND (${whereSql})
      LIMIT ?
    `;
    
    return db.prepare(sql).all(...sqlParams, params.limit);
  }
};
