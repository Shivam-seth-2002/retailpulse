const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const salesController = require('../controllers/salesController');

const router = express.Router();

router.use(auth);

router.get('/', validate(salesController.querySchema, 'query'), salesController.list);
router.post('/bulk', validate(salesController.bulkSchema, 'body'), salesController.bulk);

module.exports = router;
