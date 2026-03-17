/**
 * Production-ready structured logger utility
 * Supports console and file logging with proper formatting and error handling
 */
const fs = require('fs').promises;
const path = require('path');
const env = require('../config/env');

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const LOG_LEVEL_NAMES = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
const CURRENT_LEVEL = env.isDevelopment ? LOG_LEVELS.debug : LOG_LEVELS.info;

// Ensure logs directory exists
const LOGS_DIR = path.join(__dirname, '../../logs');
let logsDirReady = false;

async function ensureLogsDir() {
  if (!logsDirReady) {
    try {
      await fs.mkdir(LOGS_DIR, { recursive: true });
      logsDirReady = true;
    } catch (err) {
      // Fallback to console if we can't create logs dir
      console.error('Failed to create logs directory:', err.message);
    }
  }
}

function sanitizeForLogging(data) {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data };

  // Fields that should never be logged
  const sensitiveFields = [
    'password', 'password_hash', 'token', 'refresh_token',
    'api_key', 'secret', 'creditCard', 'ssn',
    'phone_number', 'email', 'stripe_payment_id',
    'authorization', 'x-api-key', 'cookie'
  ];

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const levelName = LOG_LEVEL_NAMES[level];
  const pid = process.pid;

  let logEntry = {
    timestamp,
    level: levelName,
    pid,
    message
  };

  // Add metadata if provided
  if (meta && Object.keys(meta).length > 0) {
    logEntry.meta = meta;
  }

  // Add request context if available (from async local storage in future)
  // For now, we can add basic context

  return JSON.stringify(logEntry);
}

function formatConsoleMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const levelName = LOG_LEVEL_NAMES[level];
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${levelName}] ${message}${metaStr}`;
}

async function writeToFile(level, message, meta) {
  if (!env.isDevelopment) { // Only log to file in production
    try {
      await ensureLogsDir();
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(LOGS_DIR, `${today}.log`);
      const logLine = formatMessage(level, message, meta) + '\n';
      await fs.appendFile(logFile, logLine);
    } catch (err) {
      // Don't throw - logging failure shouldn't crash the app
      console.error('Logger file write failed:', err.message);
    }
  }
}

const logger = {
  error(message, meta) {
    if (CURRENT_LEVEL >= LOG_LEVELS.error) {
      const safeMeta = sanitizeForLogging(meta);
      const formatted = formatConsoleMessage(LOG_LEVELS.error, message, safeMeta);
      console.error(formatted);
      writeToFile(LOG_LEVELS.error, message, safeMeta);
    }
  },

  warn(message, meta) {
    if (CURRENT_LEVEL >= LOG_LEVELS.warn) {
      const safeMeta = sanitizeForLogging(meta);
      const formatted = formatConsoleMessage(LOG_LEVELS.warn, message, safeMeta);
      console.warn(formatted);
      writeToFile(LOG_LEVELS.warn, message, safeMeta);
    }
  },

  info(message, meta) {
    if (CURRENT_LEVEL >= LOG_LEVELS.info) {
      const safeMeta = sanitizeForLogging(meta);
      const formatted = formatConsoleMessage(LOG_LEVELS.info, message, safeMeta);
      console.log(formatted);
      writeToFile(LOG_LEVELS.info, message, safeMeta);
    }
  },

  debug(message, meta) {
    if (CURRENT_LEVEL >= LOG_LEVELS.debug) {
      const safeMeta = sanitizeForLogging(meta);
      const formatted = formatConsoleMessage(LOG_LEVELS.debug, message, safeMeta);
      console.log(formatted);
      // Debug logs typically not written to file to avoid spam
    }
  },

  // Utility method to log HTTP requests
  request(req, res, responseTime) {
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    const level = statusCode >= 400 ? 'warn' : 'info';

    this[level](`${method} ${originalUrl}`, {
      statusCode,
      responseTime: `${responseTime}ms`,
      ip,
      userAgent: req.get('User-Agent')
    });
  },

  // Utility method for database operations
  database(operation, table, duration, error = null) {
    const meta = {
      operation,
      table,
      duration: `${duration}ms`
    };

    if (error) {
      meta.error = error.message;
      this.error(`Database ${operation} failed`, meta);
    } else {
      this.debug(`Database ${operation}`, meta);
    }
  },

  // Utility method for external API calls
  externalApi(service, operation, duration, error = null) {
    const meta = {
      service,
      operation,
      duration: `${duration}ms`
    };

    if (error) {
      meta.error = error.message;
      this.warn(`External API ${operation} failed`, meta);
    } else {
      this.debug(`External API ${operation}`, meta);
    }
  }
};

module.exports = logger;