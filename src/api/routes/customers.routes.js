/**
 * Customer Routes
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management
 */
const { Router } = require('express');
const customerController = require('../../domains/customers/customer.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: List customers
 *     tags: [Customers]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: {type: string}
 *       - in: query
 *         name: search
 *         schema: {type: string}
 *       - in: query
 *         name: page
 *         schema: {type: integer, default: 1}
 *       - in: query
 *         name: limit
 *         schema: {type: integer, default: 20}
 *     responses:
 *       200:
 *         description: Paginated list of customers
 */
router.get('/', customerController.getAll);

/**
 * @swagger
 * /api/customers/lookup:
 *   get:
 *     summary: Lookup customer by phone number (used by AI on incoming call)
 *     tags: [Customers]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: {type: string}
 *       - in: query
 *         name: phone
 *         required: true
 *         schema: {type: string}
 *     responses:
 *       200:
 *         description: Customer record or null
 */
router.get('/lookup', customerController.findByPhone);

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string}
 *     responses:
 *       200:
 *         description: Customer details with job/quote history
 */
router.get('/:id', validateUUID('id'), customerController.getById);

/**
 * @swagger
 * /api/customers/{id}/history:
 *   get:
 *     summary: Get full job and quote history for a customer
 *     tags: [Customers]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string}
 */
router.get('/:id/history', validateUUID('id'), customerController.getHistory);

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, first_name, last_name]
 *             properties:
 *               business_id: {type: string}
 *               first_name: {type: string}
 *               last_name: {type: string}
 *               phone_number: {type: string}
 *               email: {type: string}
 *               address: {type: string}
 *               zip_code: {type: string}
 *               notes: {type: string}
 */
router.post('/', requireFields(['business_id', 'first_name', 'last_name']), customerController.create);

/**
 * @swagger
 * /api/customers/{id}:
 *   patch:
 *     summary: Update a customer
 *     tags: [Customers]
 *     security: [{bearerAuth: []}]
 */
router.patch('/:id', validateUUID('id'), customerController.update);

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     summary: Delete a customer
 *     tags: [Customers]
 *     security: [{bearerAuth: []}]
 */
router.delete('/:id', validateUUID('id'), customerController.remove);

module.exports = router;
