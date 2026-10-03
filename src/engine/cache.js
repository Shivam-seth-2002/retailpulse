const { LRUCache } = require('../dataStructures/LRUCache');
const config = require('../config');

// Singleton cache instance
const cache = new LRUCache({ maxSize: config.cache.maxEntries });

module.exports = cache;
