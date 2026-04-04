/**
 * @swagger
 * tags:
 *   name: Quotes
 *   description: Quote and estimate management
 */
const { Router } = require('express');
const quoteController = require('../../domains/quotes/quote.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/quotes:
 *   get:
 *     summary: Get all quotes
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: assigned_staff_id
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: customer_id
 *         schema: { type: string }
 *       - in: query
 *         name: start_date
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: end_date
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 */
router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), quoteController.getAll);
/**
 * @swagger
 * /api/quotes/{id}:
 *   get:
 *     summary: Get a quote by ID
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', validateUUID('id'), requireResourceAccess('quote'), quoteController.getById);

/**
 * @swagger
 * /api/quotes:
 *   post:
 *     summary: Create a quote or estimate appointment
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', requireFields(['business_id', 'customer_id']), requireBusinessAccess('body'), quoteController.create);
/**
 * @swagger
 * /api/quotes/{id}:
 *   patch:
 *     summary: Update a quote or estimate appointment
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id', validateUUID('id'), requireResourceAccess('quote'), quoteController.update);

/**
 * @swagger
 * /api/quotes/{id}/send:
 *   post:
 *     summary: Send a quote
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/send', validateUUID('id'), requireResourceAccess('quote'), quoteController.sendQuote);

/**
 * @swagger
 * /api/quotes/{id}/approve:
 *   post:
 *     summary: Approve a quote and convert it to a job
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/approve', validateUUID('id'), requireResourceAccess('quote'), quoteController.approve);

/**
 * @swagger
 * /api/quotes/{id}/decline:
 *   post:
 *     summary: Decline a quote
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/decline', validateUUID('id'), requireResourceAccess('quote'), quoteController.decline);
router.delete('/:id', validateUUID('id'), requireResourceAccess('quote'), quoteController.remove);

module.exports = router;
