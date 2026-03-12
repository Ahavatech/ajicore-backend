/**
 * Express Application Setup
 * Configures middleware, routes, and error handling.
 */
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');

// Route imports
const authRoutes = require('./api/routes/auth.routes');
const jobsRoutes = require('./api/routes/jobs.routes');
const billingRoutes = require('./api/routes/billing.routes');
const inventoryRoutes = require('./api/routes/inventory.routes');
const fleetRoutes = require('./api/routes/fleet.routes');
const staffRoutes = require('./api/routes/staff.routes');
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

// Request logging (development)
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// ============================================
// Health Check
// ============================================
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ajicore',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// API Routes
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/internal', aiBridgeRoutes);

// ============================================
// Error Handling
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;