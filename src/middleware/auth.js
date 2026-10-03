const crypto = require('crypto');
const config = require('../config');
const ApiError = require('../utils/ApiError');

// Parse admin keys and read keys from config into Maps of SHA256 -> key metadata for O(1) secure lookup
const validKeys = new Map();

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

for (const key of config.apiKeys.admin) {
  validKeys.set(hashKey(key), { id: `admin-${key.substring(0, 4)}`, role: 'admin' });
}

for (const key of config.apiKeys.read) {
  validKeys.set(hashKey(key), { id: `read-${key.substring(0, 4)}`, role: 'read' });
}

function auth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return next(ApiError.unauthorized('Missing x-api-key header'));
  }

  const hashed = hashKey(apiKey);
  const keyInfo = validKeys.get(hashed);

  if (!keyInfo) {
    return next(ApiError.unauthorized('Invalid API key'));
  }

  // Attach key metadata to the request for audit logs and authorization
  req.apiKey = keyInfo;
  
  // Basic authorization: 'read' keys can only use GET and /api/v1/intents/execute
  if (keyInfo.role === 'read' && req.method !== 'GET') {
    if (req.method === 'POST' && req.originalUrl.startsWith('/api/v1/intents/execute')) {
      // Allowed
    } else {
      return next(ApiError.forbidden('Read-only API keys cannot perform this action'));
    }
  }

  next();
}

module.exports = auth;
