/**
 * @swagger
 * tags:
 *   name: Conversations
 *   description: Call / SMS / Web conversation history with full transcripts
 */
const { Router } = require('express');
const conversationController = require('../../domains/conversations/conversation.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: List conversations for a business
 *     tags: [Conversations]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: channel
 *         schema: { type: string, enum: [call, sms, web] }
 *       - in: query
 *         name: customer_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated conversations
 */
router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), conversationController.list);

/**
 * @swagger
 * /api/conversations/{id}:
 *   get:
 *     summary: Get a single conversation by id with full message timeline
 *     tags: [Conversations]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Conversation with messages
 *       404:
 *         description: Conversation not found
 */
router.get(
  '/:id',
  validateUUID('id'),
  requireFields(['business_id'], 'query'),
  requireBusinessAccess('query'),
  conversationController.show
);

module.exports = router;
