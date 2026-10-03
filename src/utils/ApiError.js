/**
 * ApiError - an Error that knows which HTTP status and error code to send.
 *
 * Throw it anywhere (controllers, services) and the central errorHandler
 * middleware turns it into:
 *   { "success": false, "error": { "code": "...", "message": "...", "details": [] } }
 */
class ApiError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details = [], code = 'BAD_REQUEST') {
    return new ApiError(400, code, message, details);
  }

  static validation(message, details = []) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Missing or invalid API key') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'This API key is not allowed to perform this action') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static conflict(message, code = 'CONFLICT') {
    return new ApiError(409, code, message);
  }
}

module.exports = ApiError;
