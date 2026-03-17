/**
 * Rate Limiting Middleware
 * In-memory rate limiting to prevent abuse without external dependencies.
 * Tracks requests per IP address with configurable limits and cleanup.
 */

const logger = require('../../utils/logger');
const { RateLimitError } = require('../../utils/errors');

// In-memory storage for rate limiting data
// Key: IP address, Value: { count, resetTime, firstRequest }
const rateLimitStore = new Map();

// Default rate limit configurations
const DEFAULT_LIMITS = {
  // General API limits
  standard: { windowMs: 15 * 60 * 1000, maxRequests: 100 }, // 100 requests per 15 minutes
  strict: { windowMs: 5 * 60 * 1000, maxRequests: 20 },     // 20 requests per 5 minutes
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 },       // 5 auth attempts per 15 minutes

  // Custom limits can be added as needed
};

/**
 * Rate limiting middleware factory.
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.maxRequests - Maximum requests allowed in the window
 * @param {string} options.keyGenerator - Function to generate the rate limit key (default: IP address)
 * @param {boolean} options.skipSuccessfulRequests - Skip rate limiting for successful responses
 * @param {boolean} options.skipFailedRequests - Skip rate limiting for failed responses
 * @returns {Function} Express middleware function
 */
function rateLimit(options = {}) {
  const {
    windowMs = DEFAULT_LIMITS.standard.windowMs,
    maxRequests = DEFAULT_LIMITS.standard.maxRequests,
    keyGenerator = (req) => getClientIP(req),
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Get or create rate limit data for this key
    let rateLimitData = rateLimitStore.get(key);
    if (!rateLimitData || now > rateLimitData.resetTime) {
      // Reset or initialize the counter
      rateLimitData = {
        count: 0,
        resetTime: now + windowMs,
        firstRequest: now,
      };
    }

    // Check if limit exceeded
    if (rateLimitData.count >= maxRequests) {
      const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);

      logger.warn('Rate limit exceeded', {
        ip: key,
        limit: maxRequests,
        windowMs,
        retryAfter,
        path: req.originalUrl,
        method: req.method,
      });

      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      );
    }

    // Increment counter
    rateLimitData.count++;

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': maxRequests - rateLimitData.count,
      'X-RateLimit-Reset': Math.floor(rateLimitData.resetTime / 1000),
    });

    // Store updated data
    rateLimitStore.set(key, rateLimitData);

    // Note: Response-based rate limit skipping (skipSuccessfulRequests/skipFailedRequests)
    // would require overriding res.send, but this is omitted for simplicity and compatibility.
    // In a real Express app, you could implement this by listening to the 'finish' event.

    next();
  };
}

/**
 * Pre-configured rate limiters for common use cases.
 */
const rateLimiters = {
  // Standard API rate limiting
  standard: rateLimit(DEFAULT_LIMITS.standard),

  // Strict rate limiting for sensitive operations
  strict: rateLimit(DEFAULT_LIMITS.strict),

  // Authentication endpoints
  auth: rateLimit(DEFAULT_LIMITS.auth),

  // Public endpoints (more lenient)
  public: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 1000,
  }),

  // API documentation (very lenient)
  docs: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10000,
  }),
};

/**
 * Get client IP address from request.
 * Handles X-Forwarded-For header for proxies.
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIP(req) {
  // Check X-Forwarded-For header (for proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Take the first IP if multiple are present
    return forwarded.split(',')[0].trim();
  }

  // Check X-Real-IP header (nginx)
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }

  // Fall back to connection remote address
  return req.connection.remoteAddress || req.socket.remoteAddress || req.ip || 'unknown';
}

/**
 * Clean up old rate limit entries to prevent memory leaks.
 * Should be called periodically (e.g., every hour).
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug('Rate limit store cleaned', { entriesRemoved: cleaned, remaining: rateLimitStore.size });
  }
}

/**
 * Get current rate limit status for a key.
 * Useful for monitoring or debugging.
 * @param {string} key - Rate limit key (usually IP)
 * @returns {Object|null} Rate limit data or null if not found
 */
function getRateLimitStatus(key) {
  return rateLimitStore.get(key) || null;
}

/**
 * Reset rate limit for a specific key.
 * Useful for administrative purposes.
 * @param {string} key - Rate limit key to reset
 */
function resetRateLimit(key) {
  rateLimitStore.delete(key);
  logger.info('Rate limit reset', { key });
}

/**
 * Get rate limit statistics.
 * @returns {Object} Statistics about the rate limit store
 */
function getRateLimitStats() {
  const now = Date.now();
  const activeLimits = Array.from(rateLimitStore.values());
  const expiredLimits = activeLimits.filter(data => now > data.resetTime);

  return {
    totalKeys: rateLimitStore.size,
    activeLimits: activeLimits.length - expiredLimits.length,
    expiredLimits: expiredLimits.length,
    memoryUsage: JSON.stringify(Array.from(rateLimitStore.entries())).length,
  };
}

// Auto-cleanup every 30 minutes
setInterval(cleanupRateLimitStore, 30 * 60 * 1000);

module.exports = {
  rateLimit,
  rateLimiters,
  cleanupRateLimitStore,
  getRateLimitStatus,
  resetRateLimit,
  getRateLimitStats,
};