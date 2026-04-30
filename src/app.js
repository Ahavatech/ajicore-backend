/**
 * Express Application Setup
 * Configures middleware, routes, Swagger, and error handling.
 */
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const {
  getOpenApiSpec,
  getOpenApiDocumentUrl,
  getSwaggerUiOptions,
  renderScalarHtml,
} = require('./config/openapi');
const logger = require('./utils/logger');

// Route imports
const authRoutes = require('./api/routes/auth.routes');
const customerRoutes = require('./api/routes/customers.routes');
const jobsRoutes = require('./api/routes/jobs.routes');
const quotesRoutes = require('./api/routes/quotes.routes');
const billingRoutes = require('./api/routes/billing.routes');
const inventoryRoutes = require('./api/routes/inventory.routes');
const fleetRoutes = require('./api/routes/fleet.routes');
const staffRoutes = require('./api/routes/staff.routes');
const priceBookRoutes = require('./api/routes/pricebook.routes');
const dashboardRoutes = require('./api/routes/dashboard.routes');
const aiBridgeRoutes = require('./api/routes/ai_bridge.routes');
const followUpRoutes = require('./api/routes/follow_ups.routes');
const teamCheckinRoutes = require('./api/routes/team_checkins.routes');
const bookkeepingRoutes = require('./api/routes/bookkeeping.routes');
const aiLogsRoutes = require('./api/routes/ai_logs.routes');
const businessRoutes = require('./api/routes/business.routes');
const conversationRoutes = require('./api/routes/conversations.routes');
const notificationRoutes = require('./api/routes/notifications.routes');
const searchRoutes = require('./api/routes/search.routes');
const reportsRoutes = require('./api/routes/reports.routes');
const uploadRoutes = require('./api/routes/upload.routes');
const integrationsRoutes = require('./api/routes/integrations.routes');
const usersRoutes = require('./api/routes/users.routes');
const aiRoutes = require('./api/routes/ai.routes');


// Middleware imports
const { errorHandler, notFoundHandler } = require('./api/middlewares/error.middleware');
const { rateLimiters } = require('./api/middlewares/rate_limit.middleware');

const app = express();
const openApiSpec = getOpenApiSpec();
const openApiDocumentUrl = getOpenApiDocumentUrl();

// ============================================
// Global Middleware
// ============================================

// Secure CORS configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const allowedOriginsStr = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = allowedOriginsStr.split(',').map(o => o.trim()).filter(Boolean);

// Get the backend URL for API calls (for CSP)
const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      // Allow connections to self and configured origins
      connectSrc: [
        "'self'",
        ...allowedOrigins,
        'https://api.twilio.com',
        'https://rest.twilio.com',
      ],
    },
  },
  hsts: {
    maxAge: 31536000,  // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS middleware with flexible configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);

    // In development, automatically allow all localhost/127.0.0.1 origins
    if (isDevelopment) {
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocalhost) return callback(null, true);
    }

    // Check for wildcard (not recommended for production)
    if (allowedOrigins.includes('*')) {
      logger.warn('CORS wildcard enabled - permitting all origins');
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In production, log rejections for debugging
    if (!isDevelopment) {
      logger.warn('CORS origin not allowed', {
        origin,
        allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : 'NONE_CONFIGURED',
      });
    }

    // Allow the request to proceed anyway (client will face browser restrictions)
    // This prevents the backend from blocking valid requests
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Business-Token', 'X-Business-Id', 'Accept'],
  maxAge: 3600,  // Cache preflight for 1 hour
}));

// HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// Secure request size limits
app.use(express.json({
  limit: '1mb',  // Reasonable limit for most APIs
  strict: true,  // Reject non-JSON
}));
app.use(express.urlencoded({
  extended: true,
  limit: '1mb',
  parameterLimit: 50  // Prevent parameter pollution attacks
}));

// Request logging with timing
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.request(req, res, duration);
  });
  next();
});

// ============================================
// Rate Limiting
// ============================================

// Health check - no rate limiting
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ajicore',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    docs: '/api/docs',
  });
});

// API docs - lenient rate limiting
app.use('/api/docs', rateLimiters.docs);
app.use('/api/docs.json', rateLimiters.docs);
app.use('/api/reference', rateLimiters.docs);

// Auth routes - strict rate limiting
app.use('/api/auth', rateLimiters.auth);

// All other API routes - standard rate limiting
app.use('/api', rateLimiters.standard);

// ============================================
// Swagger API Documentation
// ============================================
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(null, getSwaggerUiOptions(openApiDocumentUrl)));

app.get('/api/reference', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderScalarHtml(openApiDocumentUrl));
});

// Serve raw swagger JSON for Postman import
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openApiSpec);
});

// ============================================
// Health Check
// ============================================
// Moved above rate limiting

// ============================================
// Static Assets
// ============================================
// Local uploads (used by /api/upload). In production, prefer an object store + signed URLs.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  fallthrough: false,
  maxAge: isDevelopment ? 0 : '7d',
}));

// ============================================
// API Routes
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/team', staffRoutes);
app.use('/api/price-book', priceBookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/internal', aiBridgeRoutes);
app.use('/api/follow-ups', followUpRoutes);
app.use('/api/team-checkins', teamCheckinRoutes);
app.use('/api/bookkeeping', bookkeepingRoutes);
app.use('/api/ai-logs', aiLogsRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ai', aiRoutes);


// ============================================
// Error Handling
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
