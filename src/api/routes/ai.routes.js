/**
 * AI Routes
 */

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: Frontend AI assistant endpoints
 */

const { Router } = require('express');
const aiChatController = require('../../domains/ai/ai_chat.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     tags: [AI]
 *     summary: Chat with AjiCore AI assistant
 *     description: Processes a user chat message with conversation history and business context, then returns an AI-generated reply.
 *     operationId: chatWithAjiCoreAI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AIChatRequest'
 *           example:
 *             business_id: uuid-1234-5678
 *             message: Can you check my schedule for today?
 *             history:
 *               - role: assistant
 *                 content: Hello John! I am your AjiCore Assistant. How can I help you today?
 *               - role: user
 *                 content: I need to know my appointments.
 *     responses:
 *       200:
 *         description: AI response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIChatResponse'
 *             example:
 *               reply: You have 3 appointments scheduled for today. Your first dispatch is at 9:00 AM at 123 Main St.
 *       400:
 *         description: Invalid request payload
 *       401:
 *         description: Missing or invalid JWT token
 *       500:
 *         description: Internal server error
 *     x-scalar-stability: experimental
 */
router.post(
  '/chat',
  requireFields(['business_id', 'message', 'history']),
  requireBusinessAccess('body', 'business_id', { allowStaff: true }),
  aiChatController.chat
);

module.exports = router;
