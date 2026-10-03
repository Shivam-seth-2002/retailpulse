const express = require('express');
const auth = require('../middleware/auth');
const storeController = require('../controllers/storeController');

const router = express.Router();

router.use(auth);

router.get('/', storeController.list);

module.exports = router;
