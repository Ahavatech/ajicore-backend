const { Router } = require('express');
const subscriptionController = require('../../domains/subscriptions/subscription.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * tags:
 *   name: Subscriptions
 *   description: SaaS billing subscriptions and trial management
 */

/**
 * @swagger
 * /api/subscriptions/status:
 *   get:
 *     summary: Get current business subscription status
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Subscription status payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubscriptionStatusResponse'
 */
router.get('/status', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), subscriptionController.getStatus);

/**
 * @swagger
 * /api/subscriptions/start:
 *   post:
 *     summary: Start a business subscription with free trial
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StartSubscriptionRequest'
 *     responses:
 *       200:
 *         description: Subscription started or existing active subscription returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StartSubscriptionResponse'
 */
router.post('/start', requireFields(['business_id']), requireBusinessAccess('body'), subscriptionController.start);

/**
 * @swagger
 * /api/subscriptions/cancel:
 *   post:
 *     summary: Cancel subscription at period end
 *     tags: [Subscriptions]
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
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Subscription marked for cancellation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CancelSubscriptionResponse'
 */
router.post('/cancel', requireFields(['business_id']), requireBusinessAccess('body'), subscriptionController.cancel);

/**
 * @swagger
 * /api/subscriptions/resume:
 *   post:
 *     summary: Resume a subscription scheduled for cancellation
 *     tags: [Subscriptions]
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
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Subscription cancellation removed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResumeSubscriptionResponse'
 */
router.post('/resume', requireFields(['business_id']), requireBusinessAccess('body'), subscriptionController.resume);

module.exports = router;
