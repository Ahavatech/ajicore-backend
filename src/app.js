/**
 * Express Application Setup
 * Configures middleware, routes, Swagger, and error handling.
 */
const express = require('express');
const cors = require('cors');
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

const app = express();

// ============================================
// Global Middleware
// ============================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

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
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ajicore',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    docs: '/api/docs',
  });
});

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
