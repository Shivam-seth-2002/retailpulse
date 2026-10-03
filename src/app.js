const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const audit = require('./middleware/audit');
const ApiError = require('./utils/ApiError');

// Routes
const healthRoutes = require('./routes/health');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));

// Request parsing
app.use(express.json({ limit: '1mb' }));

// Logging
if (!config.isTest) {
  app.use(morgan('combined', { stream: logger.stream }));
}

// Global rate limiting for API routes
app.use('/api/', rateLimiter);

// Audit logging
app.use('/api/', audit);

// Mount routes
// Health is public, no auth required
app.use('/api/v1/health', healthRoutes);

// Catch 404
app.use((req, res, next) => {
  next(ApiError.notFound(`Cannot ${req.method} ${req.path}`));
});

// Central error handler
app.use(errorHandler);

module.exports = app;
