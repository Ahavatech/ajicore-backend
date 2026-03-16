/**
 * Dashboard Routes
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Analytics and reporting endpoints
 */
const { Router } = require('express');
const dashboardController = require('../../domains/dashboard/dashboard.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

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
 *     responses:
 *       200:
 *         description: Active jobs, today's jobs, pending quotes, overdue invoices, alerts
 */
router.get('/summary', dashboardController.getSummary);

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
router.get('/weekly-report', dashboardController.getWeeklyReport);

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
 *         schema: {type: string, enum: [7d, 30d, 90d], default: 30d}
 */
router.get('/revenue', dashboardController.getRevenueChart);

/**
 * @swagger
 * /api/dashboard/jobs-analytics:
 *   get:
 *     summary: Job analytics breakdown by status and type
 *     tags: [Dashboard]
 *     security: [{bearerAuth: []}]
 */
router.get('/jobs-analytics', dashboardController.getJobsAnalytics);

module.exports = router;
