const { JobQueue } = require('../dataStructures/JobQueue');

// Singleton job queue
const queue = new JobQueue();

module.exports = queue;
