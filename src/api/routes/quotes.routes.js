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
 *     responses:
 *       200:
 *         description: Quote list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Quote'
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quote retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quote'
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuoteInput'
 *     responses:
 *       201:
 *         description: Quote created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quote'
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuoteUpdateInput'
 *     responses:
 *       200:
 *         description: Quote updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quote'
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quote sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quote'
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quote approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Approved }
 *                 converted_to_job_id: { type: string, format: uuid }
 *                 quote:
 *                   $ref: '#/components/schemas/Quote'
 *                 job:
 *                   $ref: '#/components/schemas/Job'
 */
router.post('/:id/approve', validateUUID('id'), requireResourceAccess('quote'), quoteController.approve);

/**
 * @swagger
 * /api/quotes/{id}/convert:
 *   post:
 *     summary: Convert an approved quote to a job
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quote converted successfully
 */
router.post('/:id/convert', validateUUID('id'), requireResourceAccess('quote'), quoteController.convert);

/**
 * @swagger
 * /api/quotes/{id}/decline:
 *   post:
 *     summary: Decline a quote
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Quote declined successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quote'
 */
router.post('/:id/decline', validateUUID('id'), requireResourceAccess('quote'), quoteController.decline);
/**
 * @swagger
 * /api/quotes/{id}:
 *   delete:
 *     summary: Delete a quote
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quote deleted successfully
 */
router.delete('/:id', validateUUID('id'), requireResourceAccess('quote'), quoteController.remove);

module.exports = router;
