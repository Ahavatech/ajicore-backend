const { Router } = require('express');
const businessController = require('../../domains/business/business.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
const { validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * tags:
 *   name: Businesses
 *   description: Lightweight business reads used by the AI call center dashboard
 */

/**
 * @swagger
 * /api/businesses/{business_id}:
 *   get:
 *     summary: Get AI call center dashboard business summary
 *     tags: [Businesses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Business summary
 */
router.get('/:business_id', validateUUID('business_id'), requireBusinessAccess('params', 'business_id'), businessController.getDashboardSummary);

module.exports = router;
