/**
 * Reports Routes
 */

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Analytics, reports, and KPIs
 */

const { Router } = require('express');
const reportsController = require('../../domains/reports/reports.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/reports/kpis:
 *   get:
 *     summary: Get KPI aggregates
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: timeframe
 *         schema: { type: string, enum: ['Today', 'This Month'], default: 'This Month' }
 *     responses:
 *       200:
 *         description: KPIs retrieved successfully
 */
router.get('/kpis', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), reportsController.getKPIs);

/**
 * @swagger
 * /api/reports/financials:
 *   get:
 *     summary: Get monthly financials and breakdown
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Financials retrieved successfully
 */
router.get('/financials', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), reportsController.getFinancials);

/**
 * @swagger
 * /api/reports/top-customers:
 *   get:
 *     summary: Get top customers by revenue
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Top customers retrieved successfully
 */
router.get('/top-customers', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), reportsController.getTopCustomers);

/**
 * @swagger
 * /api/reports/team-performance:
 *   get:
 *     summary: Get team performance metrics
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Team performance retrieved successfully
 */
router.get('/team-performance', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), reportsController.getTeamPerformance);

module.exports = router;
