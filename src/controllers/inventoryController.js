const Joi = require('joi');
const inventoryRepo = require('../db/repositories/inventoryRepo');
const ApiError = require('../utils/ApiError');

const querySchema = Joi.object({
  storeId: Joi.number().required()
});

const upsertSchema = Joi.object({
  quantity: Joi.number().min(0).required(),
  reorder_level: Joi.number().min(0)
});

function list(req, res, next) {
  const { storeId } = req.query;
  const start = Date.now();
  
  try {
    const data = inventoryRepo.findByStore(storeId);
    res.json({
      success: true,
      data,
      meta: { durationMs: Date.now() - start }
    });
  } catch (err) {
    next(err);
  }
}

function upsert(req, res, next) {
  const storeId = parseInt(req.params.storeId, 10);
  const productId = parseInt(req.params.productId, 10);
  const { quantity, reorder_level } = req.body;
  const start = Date.now();
  
  try {
    const updated = inventoryRepo.upsert(storeId, productId, quantity, reorder_level);
    res.json({
      success: true,
      data: updated,
      meta: { durationMs: Date.now() - start }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  querySchema,
  upsertSchema,
  list,
  upsert
};
