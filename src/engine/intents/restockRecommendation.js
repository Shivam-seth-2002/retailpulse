const Joi = require('joi');
const { FilterTree } = require('../../dataStructures/FilterTree');
const { compileFilter } = require('../filterCompiler');

const fieldMap = new Map([
  ['store_id', { column: 'i.store_id' }],
  ['category', { column: 'p.category' }]
]);

module.exports = {
  name: 'restock_recommendation',
  description: 'Calculates recommendations based on 30 day sales velocity and lead time',
  schema: Joi.object({
    leadDays: Joi.number().min(1).default(7),
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
    
    // Average daily sales over the last 30 days × lead days − current stock
    const sql = `
      WITH recent_sales AS (
        SELECT store_id, product_id, SUM(quantity) as total_sold_30d
        FROM sales
        WHERE sold_at >= date('now', '-30 days')
        GROUP BY store_id, product_id
      )
      SELECT 
        i.store_id, 
        s.name as store_name, 
        i.product_id, 
        p.name as product_name, 
        i.quantity as current_stock,
        COALESCE(rs.total_sold_30d, 0) as total_sold_30d,
        (COALESCE(rs.total_sold_30d, 0) / 30.0) as daily_velocity,
        MAX(0, CAST(ROUND((COALESCE(rs.total_sold_30d, 0) / 30.0) * ?) AS INTEGER) - i.quantity) as recommended_qty
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN stores s ON i.store_id = s.store_id
      LEFT JOIN recent_sales rs ON i.store_id = rs.store_id AND i.product_id = rs.product_id
      WHERE (${whereSql})
      ORDER BY recommended_qty DESC
      LIMIT ?
    `;
    
    return db.prepare(sql).all(params.leadDays, ...sqlParams, params.limit);
  }
};
