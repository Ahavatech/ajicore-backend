/**
 * Express Application Setup
 * Configures middleware, routes, Swagger, and error handling.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const { getOpenApiSpec, renderScalarHtml } = require('./config/openapi');
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

// Middleware imports
const { errorHandler, notFoundHandler } = require('./api/middlewares/error.middleware');
const { rateLimiters } = require('./api/middlewares/rate_limit.middleware');

const app = express();
const openApiSpec = getOpenApiSpec();

// ============================================
// Global Middleware
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
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

// Secure CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  throw new Error('ALLOWED_ORIGINS environment variable must be set in production');
}

const isDevelopment = process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: function(origin, callback) {
    // Allow no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);

    // In development, automatically allow all localhost/127.0.0.1 origins
    // so the Vite dev server (port 5173) and any other local frontend can connect.
    if (isDevelopment) {
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocalhost) return callback(null, true);
    }

    if (allowedOrigins.includes('*')) {
      console.warn('WARNING: CORS wildcard enabled. DO NOT USE IN PRODUCTION');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS request rejected', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Business-Token'],
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
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customSiteTitle: 'Ajicore API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
}));

app.get('/api/reference', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderScalarHtml('/api/docs.json'));
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
app.use('/api/price-book', priceBookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/internal', aiBridgeRoutes);
app.use('/api/follow-ups', followUpRoutes);
app.use('/api/team-checkins', teamCheckinRoutes);
app.use('/api/bookkeeping', bookkeepingRoutes);
app.use('/api/ai-logs', aiLogsRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/conversations', conversationRoutes);

// ============================================
// Error Handling
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
