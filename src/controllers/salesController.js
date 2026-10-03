const Joi = require('joi');
const salesRepo = require('../db/repositories/salesRepo');
const { getPaginationMeta } = require('../utils/pagination');

const querySchema = Joi.object({
  from: Joi.string().isoDate(),
  to: Joi.string().isoDate(),
  storeId: Joi.number(),
  limit: Joi.number().min(1).max(100).default(50),
  cursor: Joi.number().min(0).default(0)
});

const bulkItemSchema = Joi.object({
  store_id: Joi.number().required(),
  product_id: Joi.number().required(),
  quantity: Joi.number().min(1).required(),
  amount: Joi.number().min(0).required(),
  sold_at: Joi.string().isoDate().required()
});

const bulkSchema = Joi.array().items(bulkItemSchema).max(5000).required();

function list(req, res, next) {
  const { from, to, storeId, limit, cursor } = req.query;
  const start = Date.now();
  
  try {
    const data = salesRepo.find({ from, to, storeId, limit, cursor });
    const meta = {
      durationMs: Date.now() - start,
      ...getPaginationMeta(data, 'sale_id', limit)
    };
    
    res.json({ success: true, data, meta });
  } catch (err) {
    next(err);
  }
}

function bulk(req, res, next) {
  const sales = req.body;
  const start = Date.now();
  
  try {
    salesRepo.bulkInsert(sales);
    res.status(201).json({
      success: true,
      data: { inserted: sales.length },
      meta: { durationMs: Date.now() - start }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  querySchema,
  bulkSchema,
  list,
  bulk
};
