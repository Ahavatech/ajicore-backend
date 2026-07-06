const { Router } = require('express');
const ctrl = require('../../domains/ai_logs/ai_event_log.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

router.get('/event-types', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), ctrl.eventTypes);
/**
 * @swagger
 * /api/ai-logs:
 *   get:
 *     summary: List AI activity logs for a business
 *     tags: [AI Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI activity logs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AiLogsListResponse'
 */
router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), ctrl.list);

/**
 * @swagger
 * /api/ai-logs/{log_id}:
 *   get:
 *     summary: Get a single AI activity log
 *     tags: [AI Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: log_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Single AI activity log
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AiLogEntry'
 */
router.get('/:log_id', requireResourceAccess('aiEventLog', { field: 'log_id', notFoundLabel: 'AI log entry' }), ctrl.show);
router.post('/', requireFields(['business_id', 'event_type'], 'body'), requireBusinessAccess('body'), ctrl.create);

module.exports = router;
