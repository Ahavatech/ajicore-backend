/**
 * Automated Reports Cron Job
 * Compiles and sends weekly business summary reports.
 *
 * Schedule: Every Monday at 8:00 AM (0 8 * * 1)
 *
 * Usage: Integrate with node-cron or a task scheduler.
 * Example:
 *   const cron = require('node-cron');
 *   const { runWeeklyReports } = require('./jobs/automated_reports.cron');
 *   cron.schedule('0 8 * * 1', runWeeklyReports);
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateWeeklyReport } = require('../utils/report_generator');
const notificationService = require('../domains/communications/notification.service');
const logger = require('../utils/logger');

async function runWeeklyReports() {
  logger.info('Starting weekly report generation...');

  try {
    const businesses = await prisma.business.findMany({
      include: { staff: { where: { role: 'Owner' } } },
    });

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const business of businesses) {
      const report = await generateWeeklyReport(business.id, oneWeekAgo, now);

      const summary = [
        `📊 Weekly Report for ${business.name}`,
        `Jobs: ${report.metrics.totalJobs} total, ${report.metrics.completedJobs} completed`,
        `Revenue: $${report.metrics.totalRevenue.toFixed(2)}`,
        `Expenses: $${report.metrics.totalExpenses.toFixed(2)}`,
        `Net Profit: $${report.metrics.netProfit.toFixed(2)}`,
      ].join('\n');

      // Send to business owner via SMS if phone is available
      if (business.dedicated_phone_number) {
        await notificationService.sendSms(business.dedicated_phone_number, summary);
      }

      logger.info(`Weekly report generated for ${business.name}`, report.metrics);
    }
  } catch (err) {
    logger.error('Weekly report generation failed', { error: err.message });
  }
}

module.exports = { runWeeklyReports };