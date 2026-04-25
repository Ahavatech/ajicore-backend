const { Router } = require('express');
const integrationsController = require('../../domains/integrations/integrations.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * tags:
 *   name: Integrations
 *   description: Third-party integrations (Stripe, Plaid, QuickBooks, etc.)
 */

/**
 * @swagger
 * /api/integrations/stripe/connect-url:
 *   get:
 *     summary: Generate Stripe Connect URL for account linking
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Stripe Connect URL generated successfully
 */
router.get('/stripe/connect-url', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), integrationsController.getStripeConnectUrl);

/**
 * @swagger
 * /api/integrations/plaid/link-token:
 *   get:
 *     summary: Generate a Plaid link token
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Plaid link token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 link_token:
 *                   type: string
 */
router.get('/plaid/link-token', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), integrationsController.getPlaidLinkToken);

/**
 * @swagger
 * /api/integrations/quickbooks/sync:
 *   post:
 *     summary: Queue a QuickBooks sync for a business
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id]
 *             properties:
 *               business_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: QuickBooks sync queued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 business_id: { type: string }
 *                 status: { type: string }
 *                 synced:
 *                   type: object
 */
router.post('/quickbooks/sync', requireFields(['business_id'], 'body'), requireBusinessAccess('body'), integrationsController.syncQuickBooks);

module.exports = router;
