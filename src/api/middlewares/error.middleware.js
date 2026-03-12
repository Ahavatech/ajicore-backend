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
function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`[${statusCode}] ${message}`, {
    stack: env.isDevelopment ? err.stack : undefined,
  });

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : 'Request Error',
    message: env.isProduction && statusCode >= 500
      ? 'An unexpected error occurred.'
      : message,
    ...(env.isDevelopment && { stack: err.stack }),
  });
}

module.exports = { notFoundHandler, errorHandler };