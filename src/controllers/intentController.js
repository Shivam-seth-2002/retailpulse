const Joi = require('joi');
const intentRegistry = require('../engine/intentRegistry');
const cache = require('../engine/cache');
const stableStringify = require('../utils/stableStringify');
const { getDb } = require('../db/connection');
const ApiError = require('../utils/ApiError');

const executeSchema = Joi.object({
  intent: Joi.string().required(),
  params: Joi.object().default({})
});

function list(req, res) {
  const start = Date.now();
  const intents = [];
  
  for (const [name, intent] of intentRegistry.entries()) {
    intents.push({
      name,
      description: intent.description
    });
  }
  
  res.json({
    success: true,
    data: intents,
    meta: { durationMs: Date.now() - start }
  });
}

function execute(req, res, next) {
  const { intent, params } = req.body;
  const start = Date.now();
  
  const handler = intentRegistry.get(intent);
  if (!handler) {
    return next(ApiError.notFound(`Intent '${intent}' not found`));
  }
  
  const { error, value: validatedParams } = handler.schema.validate(params, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    return next(ApiError.validation('Invalid intent parameters', details));
  }
  
  const cacheKey = `${intent}:${stableStringify(validatedParams)}`;
  const cached = cache.get(cacheKey);
  
  if (cached) {
    return res.json({
      success: true,
      data: cached,
      meta: {
        intent,
        cached: true,
        durationMs: Date.now() - start,
        rowCount: cached.length
      }
    });
  }
  
  try {
    const db = getDb();
    const data = handler.execute(validatedParams, db);
    
    if (handler.cacheTtlMs) {
      cache.set(cacheKey, data, handler.cacheTtlMs);
    }
    
    res.json({
      success: true,
      data,
      meta: {
        intent,
        cached: false,
        durationMs: Date.now() - start,
        rowCount: data.length
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  executeSchema,
  list,
  execute
};
