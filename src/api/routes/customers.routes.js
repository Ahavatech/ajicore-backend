
const { Router } = require('express');
const customerController = require('../../domains/customers/customer.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management
 */

/**
 * @swagger
 * /api/customers/metrics:
 *   get:
 *     summary: Get CRM aggregate metrics (KPI cards)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Customer KPIs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerMetrics'
 */
router.get('/metrics', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), customerController.getMetrics);

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: List customers with CRM metrics
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customers list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Customer'
 */
router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), customerController.getAll);


router.get('/lookup', requireFields(['business_id', 'phone'], 'query'), requireBusinessAccess('query'), customerController.findByPhone);


router.get('/:id', validateUUID('id'), requireResourceAccess('customer'), customerController.getById);


/**
 * @swagger
 * /api/customers/{id}/history:
 *   get:
 *     summary: Get customer jobs, quotes, and invoices
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/history', validateUUID('id'), requireFields(['business_id'], 'query'), requireBusinessAccess('query'), requireResourceAccess('customer'), customerController.getHistory);


/**
 * @swagger
 * /api/customers/{id}/billing:
 *   get:
 *     summary: Get outstanding customer invoice balance
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/billing', validateUUID('id'), requireFields(['business_id'], 'query'), requireBusinessAccess('query'), requireResourceAccess('customer'), customerController.getBilling);


/**
 * @swagger
 * /api/customers/{id}/schedule:
 *   get:
 *     summary: Get upcoming customer jobs and estimate appointments
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/schedule', validateUUID('id'), requireFields(['business_id'], 'query'), requireBusinessAccess('query'), requireResourceAccess('customer'), customerController.getSchedule);

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create a customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerInput'
 */
router.post('/', requireFields(['business_id']), requireBusinessAccess('body'), customerController.create);

/**
 * @swagger
 * /api/customers/{id}:
 *   patch:
 *     summary: Update a customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerUpdateInput'
 */
router.patch('/:id', validateUUID('id'), requireResourceAccess('customer'), customerController.update);


router.delete('/:id', validateUUID('id'), requireResourceAccess('customer'), customerController.remove);

module.exports = router;
