/**
 * Tiny custom logger.
 *
 * - Four levels: error < warn < info < debug ("silent" turns everything off).
 * - Each line looks like: 2024-01-01T10:00:00.000Z [INFO] message {"extra":"data"}
 * - Errors/warnings go to stderr, everything else to stdout.
 */
const config = require('../config');

const LEVELS = { silent: -1, error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

function write(level, message, meta) {
  if (LEVELS[level] > currentLevel) return;

  const time = new Date().toISOString();
  const extra = meta === undefined ? '' : ` ${JSON.stringify(meta)}`;
  const line = `${time} [${level.toUpperCase()}] ${message}${extra}`;

  if (level === 'error' || level === 'warn') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

const logger = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),

  // morgan (HTTP request logger) writes into this stream
  stream: {
    write: (text) => write('info', text.trim()),
  },
};

module.exports = logger;
