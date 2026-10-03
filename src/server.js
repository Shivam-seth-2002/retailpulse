const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { getDb, closeDb } = require('./db/connection');
const orchestrator = require('./workflows/orchestrator');

const server = http.createServer(app);

// Open database connection
getDb();

// Start workflow orchestrator
orchestrator.start();

server.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`, { env: config.env });
});

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  // Stop accepting new HTTP requests
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      await orchestrator.shutdown();
      closeDb();
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { error: err.message });
      process.exit(1);
    }
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, config.jobs.shutdownTimeoutMs);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
