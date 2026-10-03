const Joi = require('joi');
const { FilterTree } = require('../dataStructures/FilterTree');
const { compileFilter } = require('../filterCompiler');

const fieldMap = new Map([
  ['region', { column: 's.region' }],
  ['city', { column: 's.city' }]
]);

module.exports = {
  name: 'store_comparison',
  description: 'Revenue, units and average basket per store',
  schema: Joi.object({
    from: Joi.string().isoDate().required(),
    to: Joi.string().isoDate().required(),
    filters: Joi.object()
  }),
  cacheTtlMs: 60_000,
  
  execute: (params, db) => {
    let tree = null;
    if (params.filters) {
      tree = FilterTree.parse(params.filters);
    }
    
    const { whereSql, params: sqlParams } = compileFilter(tree, fieldMap);
    
    const sql = `
      SELECT 
        s.store_id, 
        s.name, 
        s.city, 
        SUM(sa.amount) as revenue, 
        SUM(sa.quantity) as units_sold,
        COUNT(sa.sale_id) as total_transactions,
        SUM(sa.amount) / COUNT(sa.sale_id) as average_basket
      FROM stores s
      LEFT JOIN sales sa ON s.store_id = sa.store_id AND sa.sold_at BETWEEN ? AND ?
      WHERE ${whereSql}
      GROUP BY s.store_id, s.name, s.city
      ORDER BY revenue DESC
    `;
    
    return db.prepare(sql).all(params.from, params.to, ...sqlParams);
  }
};
