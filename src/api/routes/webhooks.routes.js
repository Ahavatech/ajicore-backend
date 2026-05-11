const { Router } = require('express');
const express = require('express');
const stripeWebhookController = require('../../domains/webhooks/stripe_webhook.controller');

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Inbound third-party webhook endpoints
 */

/**
 * @swagger
 * /api/webhooks/stripe:
 *   post:
 *     summary: Receive Stripe webhook events
 *     tags: [Webhooks]
 *     parameters:
 *       - in: header
 *         name: Stripe-Signature
 *         required: true
 *         schema:
 *           type: string
 *         description: Stripe signature used to verify the raw webhook payload.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *           example:
 *             id: evt_123
 *             type: customer.subscription.updated
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StripeWebhookResponse'
 *       400:
 *         description: Invalid webhook signature or malformed request
 *       500:
 *         description: Runtime or Stripe configuration error
 */
router.post('/stripe', express.raw({ type: 'application/json' }), stripeWebhookController.handleStripeWebhook);

module.exports = router;
