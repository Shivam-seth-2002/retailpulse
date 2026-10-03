const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { processCsv } = require('../../ingestion/csvStreamer');
const cache = require('../../engine/cache');
const jobRepo = require('../../db/repositories/jobRepo');

module.exports = {
  async validateFile(context) {
    const { payload } = context;
    if (!payload.filePath || !payload.type) {
      throw new Error('Missing filePath or type in payload');
    }
    
    const absPath = path.resolve(config.ingestion.importDir, payload.filePath);
    if (!absPath.startsWith(config.ingestion.importDir)) {
      throw new Error('Path traversal detected');
    }
    
    if (!fs.existsSync(absPath)) {
      throw new Error(`File not found: ${absPath}`);
    }
    
    context.result.absPath = absPath;
    context.result.type = payload.type;
  },
  
  async streamParse(context) {
    // Kept as a placeholder to match definition, actual stream happens in batchInsert
  },
  
  async batchInsert(context) {
    const { absPath, type } = context.result;
    
    const stats = await processCsv(absPath, type, (rowsProcessed) => {
      jobRepo.updateState(context.jobId, { result: { rowsProcessed } });
    });
    
    context.result.stats = stats;
  },
  
  async invalidateCache(context) {
    cache.clear();
  },
  
  async summarize(context) {
    context.result.summary = `Processed ${context.result.stats.rowsProcessed} rows with ${context.result.stats.invalidRowsCount} errors.`;
  }
};
