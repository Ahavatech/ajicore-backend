/**
 * Maintenance Reminders Cron Job
 * Checks fleet vehicles for upcoming maintenance and sends alerts.
 *
 * Schedule: Every day at 7:00 AM (0 7 * * *)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const notificationService = require('../domains/communications/notification.service');
const logger = require('../utils/logger');

async function runMaintenanceReminders() {
  logger.info('Checking fleet maintenance reminders...');

  try {
    const vehicles = await prisma.vehicle.findMany({
      include: { business: true },
    });

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const vehicle of vehicles) {
      const alerts = [];

      // Mileage-based maintenance check
      const milesSinceMaintenance = vehicle.mileage - vehicle.last_maintenance_mileage;
      if (milesSinceMaintenance >= vehicle.maintenance_cycle_miles) {
        alerts.push(`🔧 Maintenance overdue (${milesSinceMaintenance} mi since last service)`);
      }

      // Insurance expiry check
      if (vehicle.insurance_expiry && vehicle.insurance_expiry <= thirtyDaysFromNow) {
        alerts.push(`📋 Insurance expires ${vehicle.insurance_expiry.toISOString().split('T')[0]}`);
      }

      // Registration renewal check
      if (vehicle.registration_renewal && vehicle.registration_renewal <= thirtyDaysFromNow) {
        alerts.push(`📋 Registration expires ${vehicle.registration_renewal.toISOString().split('T')[0]}`);
      }

      if (alerts.length > 0 && vehicle.business.dedicated_phone_number) {
        const message = `🚗 ${vehicle.make_model} alerts:\n${alerts.join('\n')}`;
        await notificationService.sendSms(vehicle.business.dedicated_phone_number, message);
        logger.info(`Maintenance alert sent for ${vehicle.make_model}`);
      }
    }
  } catch (err) {
    logger.error('Maintenance reminder check failed', { error: err.message });
  }
}

module.exports = { runMaintenanceReminders };