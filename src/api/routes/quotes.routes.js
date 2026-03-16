/**
 * Quote Routes
 * Quotes flow: EstimateScheduled → Draft → Sent → Approved → Job (or Declined/Expired)
 * @swagger
 * tags:
 *   name: Quotes
 *   description: Quote management and lifecycle
 */
const { Router } = require('express');
const quoteController = require('../../domains/quotes/quote.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/quotes:
 *   get:
 *     summary: List quotes
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: {type: string}
 *       - in: query
 *         name: status
 *         schema: {type: string, enum: [EstimateScheduled, Draft, Sent, Approved, Declined, Expired]}
 *       - in: query
 *         name: customer_id
 *         schema: {type: string}
 */
router.get('/', quoteController.getAll);
router.get('/:id', validateUUID('id'), quoteController.getById);

/**
 * @swagger
 * /api/quotes:
 *   post:
 *     summary: Create a quote (estimate request)
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, customer_id]
 *             properties:
 *               business_id: {type: string}
 *               customer_id: {type: string}
 *               title: {type: string}
 *               description: {type: string}
 *               scheduled_estimate_date: {type: string, format: date-time}
 *               assigned_staff_id: {type: string}
 *               is_emergency: {type: boolean}
 *               source: {type: string, enum: [AI, Manual, SMS]}
 */
router.post('/', requireFields(['business_id', 'customer_id']), quoteController.create);
router.patch('/:id', validateUUID('id'), quoteController.update);

/**
 * @swagger
 * /api/quotes/{id}/send:
 *   post:
 *     summary: Mark quote as sent (sets sent_at and calculates expiry date)
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 */
router.post('/:id/send', validateUUID('id'), quoteController.sendQuote);

/**
 * @swagger
 * /api/quotes/{id}/approve:
 *   post:
 *     summary: Approve quote and convert to Job
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assigned_staff_id: {type: string}
 *               scheduled_start_time: {type: string, format: date-time}
 *               scheduled_end_time: {type: string, format: date-time}
 */
router.post('/:id/approve', validateUUID('id'), quoteController.approve);

/**
 * @swagger
 * /api/quotes/{id}/decline:
 *   post:
 *     summary: Decline a quote
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 */
router.post('/:id/decline', validateUUID('id'), quoteController.decline);
router.delete('/:id', validateUUID('id'), quoteController.remove);

module.exports = router;
