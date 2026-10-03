const Joi = require('joi');

module.exports = {
  name: 'sales_trend',
  description: 'Sales trends over time (daily, weekly, monthly)',
  schema: Joi.object({
    from: Joi.string().isoDate().required(),
    to: Joi.string().isoDate().required(),
    interval: Joi.string().valid('daily', 'monthly').default('daily'),
    storeId: Joi.number()
  }),
  cacheTtlMs: 60_000,
  
  execute: (params, db) => {
    let dateModifier = '%Y-%m-%d';
    if (params.interval === 'monthly') {
      dateModifier = '%Y-%m';
    }
    
    let storeCondition = '';
    const sqlParams = [params.from, params.to];
    
    if (params.storeId) {
      storeCondition = 'AND store_id = ?';
      sqlParams.push(params.storeId);
    }
    
    const sql = `
      SELECT strftime('${dateModifier}', sold_at) as period, SUM(amount) as revenue, SUM(quantity) as units
      FROM sales
      WHERE sold_at BETWEEN ? AND ? ${storeCondition}
      GROUP BY period
      ORDER BY period ASC
    `;
    
    return db.prepare(sql).all(...sqlParams);
  }
};
