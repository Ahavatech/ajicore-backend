/**
 * Error Handling Middleware
 * Centralized error responses for the Express application.
 */
const logger = require('../../utils/logger');
const env = require('../../config/env');

/**
 * 404 Not Found handler.
 */
function notFoundHandler(req, res, _next) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} does not exist.`,
  });
}

/**
 * Global error handler.
 * Catches all unhandled errors and returns a structured response.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const requestId = req.id || require('crypto').randomUUID();

  // Log full error internally with request ID
  logger.error(`[${requestId}] ${err.name}: ${err.message}`, {
    stack: err.stack,
    userId: req.user?.id,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Safe response - NEVER send stack traces to clients
  const clientResponse = {
    error: getErrorType(statusCode),
    message: getClientMessage(statusCode, err),
    requestId,  // Help users and support reference the error
  };

  if (statusCode >= 500) {
    clientResponse.message = 'An internal error occurred. Please contact support with request ID: ' + requestId;
  }

  // Add retry-after header for rate limiting
  if (err.name === 'RateLimitError' && err.retryAfter) {
    res.set('Retry-After', err.retryAfter);
  }

  res.status(statusCode).json(clientResponse);
}

function getErrorType(statusCode) {
  const types = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  };
  return types[statusCode] || 'Error';
}

function getClientMessage(statusCode, err) {
  const errorName = err.name;

  // Generic messages to avoid information leakage
  const messages = {
    400: 'Invalid request data',
    401: 'Authentication required',
    403: 'Access denied',
    404: 'Resource not found',
    409: 'Resource conflict',
    422: 'Invalid data format',
    429: 'Too many requests. Please try again later',
    500: 'An internal error occurred',
    503: 'Service temporarily unavailable',
  };

  // Use specific message for known error types
  if (errorName === 'ValidationError') {
    return err.message || 'Please check your input and try again.';
  }
  if (errorName === 'AuthenticationError') {
    return 'Invalid credentials.';
  }
  if (errorName === 'ConflictError') {
    return err.message || 'That information is already in use.';
  }
  if (errorName === 'UnprocessableEntityError') {
    return err.message || 'Some information could not be processed.';
  }

  return messages[statusCode] || 'An error occurred';
}

module.exports = { notFoundHandler, errorHandler };
