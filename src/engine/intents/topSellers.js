const Joi = require('joi');
const { FilterTree } = require('../dataStructures/FilterTree');
const { compileFilter } = require('../filterCompiler');

const fieldMap = new Map([
  ['category', { column: 'p.category' }],
  ['city', { column: 's.city' }]
]);

module.exports = {
  name: 'top_sellers',
  description: 'Top N products by revenue in a date range',
  schema: Joi.object({
    from: Joi.string().isoDate().required(),
    to: Joi.string().isoDate().required(),
    filters: Joi.object(),
    limit: Joi.number().max(500).default(10)
  }),
  cacheTtlMs: 60_000,
  
  execute: (params, db) => {
    let tree = null;
    if (params.filters) {
      tree = FilterTree.parse(params.filters);
    }
    
    const { whereSql, params: sqlParams } = compileFilter(tree, fieldMap);
    
    const sql = `
      SELECT sa.product_id, p.name, p.category, SUM(sa.amount) as revenue, SUM(sa.quantity) as units_sold
      FROM sales sa
      JOIN products p ON sa.product_id = p.product_id
      JOIN stores s ON sa.store_id = s.store_id
      WHERE sa.sold_at BETWEEN ? AND ? AND (${whereSql})
      GROUP BY sa.product_id, p.name, p.category
      ORDER BY revenue DESC
      LIMIT ?
    `;
    
    return db.prepare(sql).all(params.from, params.to, ...sqlParams, params.limit);
  }
};
