/**
 * Authentication Middleware
 * Validates API keys and JWT tokens for route protection.
 */
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { verifyToken } = require('../../domains/auth/auth.service');

/**
 * Middleware to verify internal API key (used by AI Bridge routes).
 */
function requireInternalApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== env.INTERNAL_API_KEY) {
    logger.warn('Unauthorized internal API access attempt', {
      ip: req.ip,
      path: req.originalUrl,
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key.',
    });
  }

  next();
}

/**
 * Middleware to verify JWT token from Authorization header.
 * Attaches decoded user payload to req.user on success.
 *
 * Expected header format: Authorization: Bearer <token>
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token. Please sign in again.',
    });
  }

  // Attach user info to request for downstream use
  req.user = decoded;
  next();
}

module.exports = { requireInternalApiKey, requireAuth };