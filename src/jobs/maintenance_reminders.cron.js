/**
 * Maintenance Reminders Cron Job
 * Checks fleet vehicles for upcoming maintenance and sends alerts.
 * Also auto-expires old quotes daily.
 * Schedule: Every day at 7:00 AM (0 7 * * *)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const notificationService = require('../domains/communications/notification.service');
const { expireOldQuotes } = require('../domains/quotes/quote.service');
const logger = require('../utils/logger');

async function runMaintenanceReminders() {
  logger.info('Checking fleet maintenance reminders...');
  try {
    const vehicles = await prisma.vehicle.findMany({ include: { business: true } });
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    for (const vehicle of vehicles) {
      const alerts = [];
      const milesSinceMaintenance = vehicle.mileage - vehicle.last_maintenance_mileage;
      if (milesSinceMaintenance >= vehicle.maintenance_cycle_miles) {
        alerts.push(`Maintenance overdue (${milesSinceMaintenance} mi since last service)`);
      }
      if (vehicle.insurance_expiry && vehicle.insurance_expiry <= thirtyDays) {
        alerts.push(`Insurance expires ${vehicle.insurance_expiry.toISOString().split('T')[0]}`);
      }
      if (vehicle.registration_renewal && vehicle.registration_renewal <= thirtyDays) {
        alerts.push(`Registration expires ${vehicle.registration_renewal.toISOString().split('T')[0]}`);
      }
      if (alerts.length > 0 && vehicle.business.dedicated_phone_number) {
        const message = `${vehicle.make_model} alerts:\n${alerts.join('\n')}`;
        await notificationService.sendSms(vehicle.business.dedicated_phone_number, message);
        logger.info(`Alert sent for ${vehicle.make_model}`);
      }
    }
  } catch (err) {
    logger.error('Maintenance reminder check failed', { error: err.message });
  }
}

async function runQuoteExpiry() {
  logger.info('Running quote expiry check...');
  try {
    await expireOldQuotes();
  } catch (err) {
    logger.error('Quote expiry check failed', { error: err.message });
  }
}

module.exports = { runMaintenanceReminders, runQuoteExpiry };
