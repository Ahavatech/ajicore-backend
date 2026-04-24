/**
 * Integrations Routes
 * @swagger
 * tags:
 *   name: Integrations
 *   description: Third-party integrations (Stripe, etc.)
 */

const { Router } = require('express');
const integrationsController = require('../../domains/integrations/integrations.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: Stripe Connect OAuth URL
 *       400:
 *         description: Missing business_id parameter
 *       500:
 *         description: Failed to generate Stripe Connect URL
 */
router.get('/stripe/connect-url', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), integrationsController.getStripeConnectUrl);

module.exports = router;
