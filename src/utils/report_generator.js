/**
 * Report Generator Utility
 * Compiles business data into structured reports for weekly summaries,
 * profit/loss statements, and job completion metrics.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Generate a weekly business summary report.
 * @param {string} businessId - The business UUID.
 * @param {Date} startDate - Report period start.
 * @param {Date} endDate - Report period end.
 * @returns {Object} Compiled report data.
 */
async function generateWeeklyReport(businessId, startDate, endDate) {
  const [jobs, invoices, expenses] = await Promise.all([
    prisma.job.findMany({
      where: {
        business_id: businessId,
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.quote_Invoice.findMany({
      where: {
        job: { business_id: businessId },
        createdAt: { gte: startDate, lte: endDate },
        type: 'Invoice',
      },
    }),
    prisma.expense.findMany({
      where: {
        business_id: businessId,
        date: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const completedJobs = jobs.filter((j) => j.status === 'Completed').length;

  return {
    period: { start: startDate, end: endDate },
    businessId,
    metrics: {
      totalJobs: jobs.length,
      completedJobs,
      pendingJobs: jobs.filter((j) => j.status === 'Pending').length,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
    },
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { generateWeeklyReport };