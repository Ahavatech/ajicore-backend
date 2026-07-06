/**
 * Notifications Routes
 */

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notification management
 */

const { Router } = require('express');
const notificationController = require('../../domains/notifications/notification.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get notifications for a business
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 */
router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), notificationController.getNotifications);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch('/:id/read', validateUUID('id'), notificationController.markAsRead);

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               business_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.post('/mark-all-read', requireFields(['business_id'], 'body'), requireBusinessAccess('body'), notificationController.markAllAsRead);

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Create a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               business_id:
 *                 type: string
 *                 format: uuid
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *               link:
 *                 type: string
 *     responses:
 *       201:
 *         description: Notification created successfully
 */
router.post('/', requireFields(['business_id', 'title', 'message'], 'body'), requireBusinessAccess('body'), notificationController.createNotification);

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Notification deleted successfully
 */
router.delete('/:id', validateUUID('id'), notificationController.deleteNotification);

module.exports = router;
