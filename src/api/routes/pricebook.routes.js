/**
 * Price Book Routes
 * @swagger
 * tags:
 *   name: PriceBook
 *   description: Service categories and price book management
 */
const { Router } = require('express');
const pbController = require('../../domains/pricebook/pricebook.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

// ---- Service Categories ----
router.get('/categories', pbController.getCategories);
router.post('/categories', requireFields(['business_id', 'name']), pbController.createCategory);
router.patch('/categories/:id', validateUUID('id'), pbController.updateCategory);
router.delete('/categories/:id', validateUUID('id'), pbController.deleteCategory);

// ---- Price Book Items ----
/**
 * @swagger
 * /api/price-book:
 *   get:
 *     summary: List price book items
 *     tags: [PriceBook]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: {type: string}
 *       - in: query
 *         name: category_id
 *         schema: {type: string}
 *       - in: query
 *         name: search
 *         schema: {type: string}
 *       - in: query
 *         name: can_quote_phone
 *         schema: {type: boolean}
 */
router.get('/', pbController.getItems);
router.get('/suggestions', pbController.getSuggestions);
router.get('/:id', validateUUID('id'), pbController.getItemById);

/**
 * @swagger
 * /api/price-book:
 *   post:
 *     summary: Create a price book item
 *     tags: [PriceBook]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, name]
 *             properties:
 *               business_id: {type: string}
 *               name: {type: string}
 *               category_id: {type: string}
 *               can_quote_phone: {type: boolean}
 *               price_type: {type: string, enum: [Fixed, Range, NeedsOnsite]}
 *               price: {type: number}
 *               price_min: {type: number}
 *               price_max: {type: number}
 *               visit_type: {type: string, enum: [FreeEstimate, PaidServiceCall]}
 *               service_call_fee: {type: number}
 */
router.post('/', requireFields(['business_id', 'name']), pbController.createItem);
router.patch('/:id', validateUUID('id'), pbController.updateItem);
router.delete('/:id', validateUUID('id'), pbController.deleteItem);

module.exports = router;
