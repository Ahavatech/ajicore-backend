/**
 * @swagger
 * tags:
 *   name: Conversations
 *   description: Customer conversation history from call and SMS events
 */
const { Router } = require('express');
const conversationController = require('../../domains/conversations/conversation.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: List customer conversations
 *     tags: [Conversations]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: channel
 *         schema: { type: string, enum: [call, sms] }
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
 *         description: Paginated conversations
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConversationListResponse'
 */
router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), conversationController.list);

/**
 * @swagger
 * /api/conversations/{customer_id}:
 *   get:
 *     summary: Get conversation activity for a customer
 *     tags: [Conversations]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: customer_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: channel
 *         schema: { type: string, enum: [call, sms] }
 *     responses:
 *       200:
 *         description: Conversation detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConversationDetailResponse'
 */
router.get(
  '/:customer_id',
  validateUUID('customer_id'),
  requireFields(['business_id'], 'query'),
  requireBusinessAccess('query'),
  requireResourceAccess('customer', { source: 'params', field: 'customer_id', notFoundLabel: 'customer' }),
  conversationController.show
);

module.exports = router;
