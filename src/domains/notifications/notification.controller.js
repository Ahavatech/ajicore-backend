/**
 * Notification Controller
 * Handles HTTP logic for notifications.
 */
const notificationService = require('./notification.service');

async function getNotifications(req, res, next) {
  try {
    const { business_id, limit = 50, offset = 0 } = req.query;
    const result = await notificationService.getNotifications({
      business_id,
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function markAsRead(req, res, next) {
  try {
    const notification = await notificationService.markAsRead(req.params.id);
    res.json(notification);
  } catch (err) { next(err); }
}

async function markAllAsRead(req, res, next) {
  try {
    const { business_id } = req.body;
    await notificationService.markAllAsRead(business_id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
}

async function createNotification(req, res, next) {
  try {
    const notification = await notificationService.createNotification(req.body);
    res.status(201).json(notification);
  } catch (err) { next(err); }
}

async function deleteNotification(req, res, next) {
  try {
    await notificationService.deleteNotification(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
  deleteNotification,
};
