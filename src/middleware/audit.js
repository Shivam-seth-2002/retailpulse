const auditRepo = require('../db/repositories/auditRepo');
const logger = require('../utils/logger');

function audit(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration_ms = Date.now() - start;
    
    // Only audit /api/v1 routes
    if (!req.path.startsWith('/api/v1')) return;
    
    // For intents, capture the intent name if available
    let intentName = null;
    if (req.path === '/api/v1/intents/execute' && req.body && req.body.intent) {
      intentName = req.body.intent;
    }

    try {
      auditRepo.create({
        api_key_id: req.apiKey ? req.apiKey.id : 'unauthenticated',
        method: req.method,
        path: req.path,
        intent: intentName,
        status: res.statusCode,
        duration_ms
      });
    } catch (err) {
      logger.error('Failed to write audit log', { error: err.message });
    }
  });
  
  next();
}

module.exports = audit;
