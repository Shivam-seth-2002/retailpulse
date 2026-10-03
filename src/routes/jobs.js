const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const jobController = require('../controllers/jobController');

const router = express.Router();

router.use(auth);

router.get('/', jobController.list);
router.get('/:id', jobController.get);
// Only admin keys can create or delete jobs
router.post('/', (req, res, next) => {
  if (req.apiKey && req.apiKey.role !== 'admin') {
    return next(require('../utils/ApiError').forbidden('Admin role required'));
  }
  next();
}, validate(jobController.createSchema, 'body'), jobController.create);

router.post('/import', (req, res, next) => {
  if (req.apiKey && req.apiKey.role !== 'admin') {
    return next(require('../utils/ApiError').forbidden('Admin role required'));
  }
  next();
}, validate(jobController.importSchema, 'body'), jobController.createImport);

router.delete('/:id', (req, res, next) => {
  if (req.apiKey && req.apiKey.role !== 'admin') {
    return next(require('../utils/ApiError').forbidden('Admin role required'));
  }
  next();
}, jobController.remove);

module.exports = router;
