const { getDb } = require('../../db/connection');
const restockIntent = require('../../engine/intents/restockRecommendation');

module.exports = {
  async findLowStock(context) {
    // Handled in computeRecommendations using the intent
  },
  
  async computeRecommendations(context) {
    const db = getDb();
    // Use the intent logic to find recommendations
    const data = restockIntent.execute({ leadDays: 7, limit: 100 }, db);
    context.result.recommendations = data.filter(d => d.recommended_qty > 0);
  },
  
  async persistAlerts(context) {
    const db = getDb();
    const alerts = context.result.recommendations;
    
    const insert = db.prepare(`
      INSERT INTO restock_alerts (job_id, store_id, product_id, quantity, reorder_level, recommended_qty)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insert.run(
          context.jobId,
          item.store_id,
          item.product_id,
          item.current_stock,
          item.current_stock, // using current stock since reorder level isn't in intent output
          item.recommended_qty
        );
      }
    });
    
    insertMany(alerts);
    context.result.summary = `Generated ${alerts.length} restock alerts`;
    delete context.result.recommendations;
  }
};
