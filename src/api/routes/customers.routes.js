
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

router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), customerController.getAll);


router.get('/lookup', requireFields(['business_id', 'phone'], 'query'), requireBusinessAccess('query'), customerController.findByPhone);


router.get('/:id', validateUUID('id'), requireResourceAccess('customer'), customerController.getById);


router.get('/:id/history', validateUUID('id'), requireResourceAccess('customer'), customerController.getHistory);


router.post('/', requireFields(['business_id', 'first_name', 'last_name']), requireBusinessAccess('body'), customerController.create);

router.patch('/:id', validateUUID('id'), requireResourceAccess('customer'), customerController.update);


router.delete('/:id', validateUUID('id'), requireResourceAccess('customer'), customerController.remove);

module.exports = router;
