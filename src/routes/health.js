const express = require('express');
const { isConnected } = require('../db/connection');
const queue = require('../workflows/queue');
const cache = require('../engine/cache');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      dbConnected: isConnected(),
      queueSize: queue.size(),
      cacheStats: cache.stats()
    }
  });
});

module.exports = router;
