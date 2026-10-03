const Joi = require('joi');
const productRepo = require('../db/repositories/productRepo');
const ApiError = require('../utils/ApiError');
const { getPaginationMeta } = require('../utils/pagination');

const createSchema = Joi.object({
  sku: Joi.string().required(),
  name: Joi.string().required(),
  category: Joi.string().required(),
  unit_price: Joi.number().min(0).required()
});

const updateSchema = Joi.object({
  category: Joi.string(),
  unit_price: Joi.number().min(0)
}).min(1);

const querySchema = Joi.object({
  category: Joi.string(),
  limit: Joi.number().min(1).max(100).default(50),
  cursor: Joi.number().min(0).default(0)
});

function list(req, res) {
  const { category, limit, cursor } = req.query;
  const start = Date.now();
  
  const data = productRepo.findAll({ category, limit, cursor });
  const meta = {
    durationMs: Date.now() - start,
    ...getPaginationMeta(data, 'product_id', limit)
  };
  
  res.json({ success: true, data, meta });
}

function get(req, res, next) {
  const id = parseInt(req.params.id, 10);
  const start = Date.now();
  const product = productRepo.findById(id);
  
  if (!product) {
    return next(ApiError.notFound('Product not found'));
  }
  
  res.json({ 
    success: true, 
    data: product, 
    meta: { durationMs: Date.now() - start } 
  });
}

function create(req, res, next) {
  const start = Date.now();
  try {
    const product = productRepo.create(req.body);
    res.status(201).json({ 
      success: true, 
      data: product,
      meta: { durationMs: Date.now() - start }
    });
  } catch (err) {
    next(err);
  }
}

function update(req, res, next) {
  const id = parseInt(req.params.id, 10);
  const start = Date.now();
  
  const product = productRepo.findById(id);
  if (!product) {
    return next(ApiError.notFound('Product not found'));
  }
  
  try {
    const updated = productRepo.update(id, req.body);
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
  createSchema,
  updateSchema,
  querySchema,
  list,
  get,
  create,
  update
};
