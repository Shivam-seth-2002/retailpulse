const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === 'ApiError') {
    const payload = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      }
    };
    if (err.details && err.details.length > 0) {
      payload.error.details = err.details;
    }
    
    // Log warnings for 4xx, info for 404, error for 5xx (not caught here usually)
    if (err.statusCode >= 500) {
      logger.error('Unhandled ApiError', { message: err.message, stack: err.stack });
    } else {
      logger.warn('API Error', { status: err.statusCode, code: err.code, path: req.path });
    }

    return res.status(err.statusCode).json(payload);
  }

  // Handle SQLite errors (e.g., UNIQUE constraint failure)
  if (err.name === 'SqliteError') {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A resource with this unique value already exists'
        }
      });
    }
  }

  // Handle unexpected errors
  logger.error('Unexpected error', { 
    message: err.message, 
    stack: err.stack, 
    path: req.path,
    method: req.method 
  });
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
}

module.exports = errorHandler;
