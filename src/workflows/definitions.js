module.exports = {
  CSV_IMPORT: ['validateFile', 'streamParse', 'batchInsert', 'invalidateCache', 'summarize'],
  DAILY_REPORT: ['aggregateSales', 'computeKpis', 'persistReport'],
  RESTOCK_ALERT: ['findLowStock', 'computeRecommendations', 'persistAlerts']
};
