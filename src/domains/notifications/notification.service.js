/**
 * Notification Service
 * Business logic for notification management.
 */
const prisma = require('../../lib/prisma');

async function getNotifications({ business_id, limit = 50, offset = 0 }) {
  const [data, total, unread_count] = await Promise.all([
    prisma.notification.findMany({
      where: { business_id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where: { business_id } }),
    prisma.notification.count({ where: { business_id, is_read: false } }),
  ]);

  return { data, total, unread_count };
}

async function markAsRead(notificationId) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { is_read: true },
  });
}

async function markAllAsRead(businessId) {
  return prisma.notification.updateMany({
    where: { business_id: businessId, is_read: false },
    data: { is_read: true },
  });
}

async function createNotification(data) {
  return prisma.notification.create({
    data: {
      business_id: data.business_id,
      title: data.title,
      message: data.message,
      type: data.type || 'SystemAlert',
      link: data.link || null,
      is_read: false,
    },
  });
}

async function deleteNotification(notificationId) {
  return prisma.notification.delete({
    where: { id: notificationId },
  });
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
  deleteNotification,
};
