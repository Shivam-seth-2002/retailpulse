/**
 * Jest setup file - runs before every test file (configured in package.json).
 * It sets environment variables BEFORE any app module reads the config.
 */
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:'; // every test file gets a fresh in-memory database
process.env.ADMIN_API_KEYS = 'test-admin-key';
process.env.READ_API_KEYS = 'test-read-key';
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_MAX = '1000';
process.env.ENABLE_SCHEDULER = 'false';
process.env.JOB_BACKOFF_BASE_MS = '10'; // fast retries in tests
process.env.BATCH_SIZE = '50'; // small batches so tests exercise batching
