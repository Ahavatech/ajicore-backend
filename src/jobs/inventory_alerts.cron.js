/**
 * Inventory Alerts Cron Job
 * Checks for low-stock materials and sends restock notifications.
 *
 * Schedule: Every day at 9:00 AM (0 9 * * *)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const notificationService = require('../domains/communications/notification.service');
const logger = require('../utils/logger');

async function runInventoryAlerts() {
  logger.info('Checking inventory levels...');

  try {
    const lowStockMaterials = await prisma.material.findMany({
      where: {
        quantity_on_hand: { lte: prisma.raw('restock_threshold') },
      },
      include: { business: true },
    });

    // Fallback: fetch all and filter manually (Prisma doesn't support column comparison directly)
    const allMaterials = await prisma.material.findMany({
      include: { business: true },
    });

    const lowStock = allMaterials.filter((m) => m.quantity_on_hand <= m.restock_threshold);

    // Group by business
    const byBusiness = {};
    for (const material of lowStock) {
      if (!byBusiness[material.business_id]) {
        byBusiness[material.business_id] = {
          business: material.business,
          materials: [],
        };
      }
      byBusiness[material.business_id].materials.push(material);
    }

    // Send alerts per business
    for (const [businessId, data] of Object.entries(byBusiness)) {
      const items = data.materials
        .map((m) => `• ${m.name}: ${m.quantity_on_hand} remaining (threshold: ${m.restock_threshold})`)
        .join('\n');

      const message = `📦 Low Stock Alert for ${data.business.name}:\n${items}`;

      if (data.business.dedicated_phone_number) {
        await notificationService.sendSms(data.business.dedicated_phone_number, message);
      }

      logger.info(`Inventory alert sent for business ${data.business.name}`, {
        lowStockCount: data.materials.length,
      });
    }
  } catch (err) {
    logger.error('Inventory alert check failed', { error: err.message });
  }
}

module.exports = { runInventoryAlerts };