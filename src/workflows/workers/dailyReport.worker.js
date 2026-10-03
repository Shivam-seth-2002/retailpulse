const { getDb } = require('../../db/connection');

module.exports = {
  async aggregateSales(context) {
    const db = getDb();
    const date = context.payload.date;
    
    const sql = `
      SELECT store_id, SUM(amount) as total_revenue, SUM(quantity) as total_units
      FROM sales
      WHERE sold_at LIKE ?
      GROUP BY store_id
    `;
    
    const data = db.prepare(sql).all(`${date}%`);
    context.result.aggregated = data;
    context.result.date = date;
  },
  
  async computeKpis(context) {
    const aggregated = context.result.aggregated;
    let totalRevenue = 0;
    let totalUnits = 0;
    
    for (const row of aggregated) {
      totalRevenue += row.total_revenue;
      totalUnits += row.total_units;
    }
    
    context.result.kpis = {
      totalRevenue,
      totalUnits,
      storeCount: aggregated.length
    };
  },
  
  async persistReport(context) {
    const db = getDb();
    const { date, kpis } = context.result;
    
    db.prepare(`
      INSERT INTO daily_reports (report_date, data, job_id)
      VALUES (?, ?, ?)
      ON CONFLICT(report_date) DO UPDATE SET data = excluded.data, job_id = excluded.job_id
    `).run(date, JSON.stringify(kpis), context.jobId);
    
    context.result.summary = `Generated report for ${date}: Revenue ${kpis.totalRevenue}`;
    delete context.result.aggregated; // remove raw data to save space in jobs table
  }
};
