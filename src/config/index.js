/**
 * Central configuration.
 *
 * Every setting is read from environment variables (loaded from `.env` by dotenv)
 * with a sensible default, so the rest of the code never touches process.env directly.
 */
const path = require('path');

// quiet: true stops dotenv from printing a banner on every start
require('dotenv').config({ quiet: true });

const ROOT_DIR = path.resolve(__dirname, '..', '..');

/** Turn "a, b,,c" into ['a', 'b', 'c'] */
function list(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Read an integer env var, falling back to a default */
function int(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/** Resolve a path relative to the project root (":memory:" is kept as-is for SQLite) */
function resolvePath(value) {
  if (value === ':memory:') return value;
  return path.resolve(ROOT_DIR, value);
}

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isProduction: env === 'production',
  isTest: env === 'test',
  rootDir: ROOT_DIR,
  port: int(process.env.PORT, 3000),

  dbPath: resolvePath(process.env.DB_PATH || 'data/retailpulse.db'),

  apiKeys: {
    admin: list(process.env.ADMIN_API_KEYS),
    read: list(process.env.READ_API_KEYS),
  },

  corsOrigins: list(process.env.CORS_ORIGINS || 'http://localhost:3000'),

  rateLimit: {
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: int(process.env.RATE_LIMIT_MAX, 100),
  },

  cache: {
    maxEntries: int(process.env.CACHE_MAX_ENTRIES, 500),
  },

  jobs: {
    concurrency: int(process.env.JOB_CONCURRENCY, 2),
    maxRetries: int(process.env.JOB_MAX_RETRIES, 3),
    backoffBaseMs: int(process.env.JOB_BACKOFF_BASE_MS, 1000),
    shutdownTimeoutMs: int(process.env.SHUTDOWN_TIMEOUT_MS, 10_000),
    enableScheduler: (process.env.ENABLE_SCHEDULER || 'true') === 'true',
    dailyReportIntervalMs: 24 * 60 * 60 * 1000,
  },

  ingestion: {
    batchSize: int(process.env.BATCH_SIZE, 1000),
    importDir: resolvePath(process.env.IMPORT_DIR || 'data'),
  },

  seed: {
    salesRows: int(process.env.SEED_SALES_ROWS, 200_000),
  },

  logLevel: process.env.LOG_LEVEL || (env === 'test' ? 'silent' : 'info'),
};

module.exports = config;
