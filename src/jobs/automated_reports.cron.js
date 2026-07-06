/**
 * Automated Reports Cron Job
 * Compiles and sends weekly business summary reports.
 * Schedule: Every Monday at 8:00 AM (0 8 * * 1)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateWeeklyReport } = require('../utils/report_generator');
const notificationService = require('../domains/communications/notification.service');
const logger = require('../utils/logger');

async function runWeeklyReports() {
  logger.info('Starting weekly report generation...');
  try {
    const businesses = await prisma.business.findMany();
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const business of businesses) {
      const report = await generateWeeklyReport(business.id, oneWeekAgo, now);
      const m = report.metrics;
      const summary = [
        `Weekly Report for ${business.name}`,
        `Jobs: ${m.total_jobs} total, ${m.completed_jobs} completed`,
        `Quotes: ${m.new_quotes} new, ${m.converted_quotes} converted`,
        `Revenue: $${m.total_revenue.toFixed(2)}`,
        `Expenses: $${m.total_expenses.toFixed(2)}`,
        `Net Profit: $${m.net_profit.toFixed(2)}`,
      ].join('\n');

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
