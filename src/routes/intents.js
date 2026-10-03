const express = require('express');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const intentController = require('../controllers/intentController');

const router = express.Router();

router.use(auth);

router.get('/', intentController.list);
router.post('/execute', validate(intentController.executeSchema, 'body'), intentController.execute);

module.exports = router;
