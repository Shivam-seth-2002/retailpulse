const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const inventoryController = require('../controllers/inventoryController');

const router = express.Router();

router.use(auth);

router.get('/', validate(inventoryController.querySchema, 'query'), inventoryController.list);
router.put('/:storeId/:productId', validate(inventoryController.upsertSchema, 'body'), inventoryController.upsert);

module.exports = router;
