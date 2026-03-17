/**
 * Express Application Setup
 * Configures middleware, routes, Swagger, and error handling.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
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

// Middleware imports
const { errorHandler, notFoundHandler } = require('./api/middlewares/error.middleware');
const { rateLimiters } = require('./api/middlewares/rate_limit.middleware');

const app = express();

// ============================================
// Global Middleware
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
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
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  throw new Error('ALLOWED_ORIGINS environment variable must be set in production');
}

app.use(cors({
  origin: function(origin, callback) {
    // Allow no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes('*')) {
      // Development only
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
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

// Auth routes - strict rate limiting
app.use('/api/auth', rateLimiters.auth);

// All other API routes - standard rate limiting
app.use('/api', rateLimiters.standard);

// ============================================
// Swagger API Documentation
// ============================================
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Ajicore API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
}));

// Serve raw swagger JSON for Postman import
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
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

// ============================================
// Error Handling
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
