/**
 * Dashboard Routes
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Analytics and reporting endpoints
 */
const { Router } = require('express');
const dashboardController = require('../../domains/dashboard/dashboard.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     summary: Get dashboard KPI summary
 *     tags: [Dashboard]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: {type: string}
 *       - in: query
 *         name: period
 *         schema: {type: string, enum: [7d, 30d, 90d], default: 7d}
 *     responses:
 *       200:
 *         description: Frontend-ready dashboard summary payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardSummary'
 */
router.get('/summary', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), dashboardController.getSummary);

/**
 * @swagger
 * /api/dashboard/weekly-report:
 *   get:
 *     summary: Generate weekly business report
 *     tags: [Dashboard]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: {type: string}
 *       - in: query
 *         name: start_date
 *         schema: {type: string, format: date}
 *       - in: query
 *         name: end_date
 *         schema: {type: string, format: date}
 */
router.get('/weekly-report', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), dashboardController.getWeeklyReport);

/**
 * @swagger
 * /api/dashboard/revenue:
 *   get:
 *     summary: Revenue chart data
 *     tags: [Dashboard]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: {type: string}
 *       - in: query
 *         name: period
 *         schema: {type: string, enum: [7d, 30d, 90d], default: 7d}
 *     responses:
 *       200:
 *         description: Revenue totals, trend, and chart data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardRevenue'
 */
router.get('/revenue', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), dashboardController.getRevenueChart);

/**
 * @swagger
 * /api/dashboard/jobs-analytics:
 *   get:
 *     summary: Job analytics breakdown by status, type, and chart data
 *     tags: [Dashboard]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: {type: string}
 *       - in: query
 *         name: period
 *         schema: {type: string, enum: [7d, 30d, 90d], default: 7d}
 *     responses:
 *       200:
 *         description: Jobs analytics payload with fallback chart_data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardJobsAnalytics'
 */
router.get('/jobs-analytics', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), dashboardController.getJobsAnalytics);

module.exports = router;
