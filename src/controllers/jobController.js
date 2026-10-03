const Joi = require('joi');
const jobRepo = require('../db/repositories/jobRepo');
const orchestrator = require('../workflows/orchestrator');
const definitions = require('../workflows/definitions');
const ApiError = require('../utils/ApiError');

const createSchema = Joi.object({
  type: Joi.string().valid(...Object.keys(definitions)).required(),
  payload: Joi.object().default({}),
  priority: Joi.number().valid(0, 1, 2).default(0)
});

const importSchema = Joi.object({
  filePath: Joi.string().required(),
  type: Joi.string().valid('stores', 'products', 'inventory', 'sales').required(),
  priority: Joi.number().valid(0, 1, 2).default(0)
});

function list(req, res) {
  const { status } = req.query;
  const start = Date.now();
  
  const data = jobRepo.findAll(status);
  
  res.json({
    success: true,
    data,
    meta: { durationMs: Date.now() - start }
  });
}

function get(req, res, next) {
  const start = Date.now();
  const job = jobRepo.findById(req.params.id);
  
  if (!job) {
    return next(ApiError.notFound('Job not found'));
  }
  
  res.json({
    success: true,
    data: job,
    meta: { durationMs: Date.now() - start }
  });
}

function create(req, res) {
  const start = Date.now();
  const jobId = orchestrator.enqueue(req.body);
  
  res.status(202).json({
    success: true,
    data: { id: jobId },
    meta: { durationMs: Date.now() - start }
  });
}

function createImport(req, res) {
  const start = Date.now();
  
  const jobId = orchestrator.enqueue({
    type: 'CSV_IMPORT',
    payload: {
      filePath: req.body.filePath,
      type: req.body.type
    },
    priority: req.body.priority
  });
  
  res.status(202).json({
    success: true,
    data: { id: jobId },
    meta: { durationMs: Date.now() - start }
  });
}

function remove(req, res, next) {
  const start = Date.now();
  const success = orchestrator.cancel(req.params.id);
  
  if (!success) {
    return next(ApiError.conflict('Job cannot be cancelled (not found or not PENDING)'));
  }
  
  res.json({
    success: true,
    data: { cancelled: true },
    meta: { durationMs: Date.now() - start }
  });
}

module.exports = {
  createSchema,
  importSchema,
  list,
  get,
  create,
  createImport,
  remove
};
