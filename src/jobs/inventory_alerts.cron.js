/**
 * Inventory Alerts Cron Job
 * Checks for low-stock materials and sends restock notifications.
 * Schedule: Every day at 9:00 AM (0 9 * * *)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const notificationService = require('../domains/communications/notification.service');
const logger = require('../utils/logger');

async function runInventoryAlerts() {
  logger.info('Checking inventory levels...');
  try {
    const allMaterials = await prisma.material.findMany({ include: { business: true } });
    const lowStock = allMaterials.filter((m) => m.quantity_on_hand <= m.restock_threshold);

    const byBusiness = {};
    for (const material of lowStock) {
      if (!byBusiness[material.business_id]) {
        byBusiness[material.business_id] = { business: material.business, materials: [] };
      }
      byBusiness[material.business_id].materials.push(material);
    }

    for (const [, data] of Object.entries(byBusiness)) {
      const items = data.materials
        .map((m) => `• ${m.name}: ${m.quantity_on_hand} left (min: ${m.restock_threshold})`)
        .join('\n');

      const message = `Low Stock Alert for ${data.business.name}:\n${items}`;
      if (data.business.dedicated_phone_number) {
        await notificationService.sendSms(data.business.dedicated_phone_number, message);
      }
      logger.info(`Inventory alert for ${data.business.name}: ${data.materials.length} items low`);
    }
  } catch (err) {
    logger.error('Inventory alert check failed', { error: err.message });
  }
}

async function expireOldQuotes() {
  const { PrismaClient: P } = require('@prisma/client');
  const p = new P();
  const { expireOldQuotes: expire } = require('../domains/quotes/quote.service');
  await expire();
}

module.exports = { runInventoryAlerts, expireOldQuotes };
