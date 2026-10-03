const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const productController = require('../controllers/productController');

const router = express.Router();

router.use(auth);

router.get('/', validate(productController.querySchema, 'query'), productController.list);
router.get('/:id', productController.get);
router.post('/', validate(productController.createSchema, 'body'), productController.create);
router.patch('/:id', validate(productController.updateSchema, 'body'), productController.update);

module.exports = router;
