const rateLimit = require('express-rate-limit');
const config = require('../config');
const ApiError = require('../utils/ApiError');

const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  validate: { xForwardedForHeader: false, ip: false },
  // Use the API key ID as the key for rate limiting
  keyGenerator: (req) => {
    return req.apiKey ? req.apiKey.id : req.ip;
  },
  handler: (req, res, next) => {
    next(ApiError.conflict('Too many requests, please try again later', 'RATE_LIMIT_EXCEEDED'));
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = rateLimiter;
