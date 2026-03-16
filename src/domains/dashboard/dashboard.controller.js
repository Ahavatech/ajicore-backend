/**
 * Dashboard Controller
 * Summary metrics and analytics for the business dashboard.
 */
const { generateWeeklyReport, generateDashboardSummary } = require('../../utils/report_generator');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getSummary(req, res, next) {
  try {
    const { business_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    const summary = await generateDashboardSummary(business_id);
    res.json(summary);
  } catch (err) { next(err); }
}

async function getWeeklyReport(req, res, next) {
  try {
    const { business_id, start_date, end_date } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });

    const end = end_date ? new Date(end_date) : new Date();
    const start = start_date ? new Date(start_date) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const report = await generateWeeklyReport(business_id, start, end);
    res.json(report);
  } catch (err) { next(err); }
}

async function getRevenueChart(req, res, next) {
  try {
    const { business_id, period = '30d' } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const payments = await prisma.payment.findMany({
      where: { invoice: { job: { business_id } }, paid_at: { gte: startDate } },
      orderBy: { paid_at: 'asc' },
    });

    // Group by day
    const grouped = {};
    payments.forEach((p) => {
      const day = p.paid_at.toISOString().split('T')[0];
      grouped[day] = (grouped[day] || 0) + p.amount;
    });

    const chart = Object.entries(grouped).map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }));
    res.json({ period, chart });
  } catch (err) { next(err); }
}

async function getJobsAnalytics(req, res, next) {
  try {
    const { business_id, period = '30d' } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [jobs, byStatus, byType] = await Promise.all([
      prisma.job.count({ where: { business_id, createdAt: { gte: startDate } } }),
      prisma.job.groupBy({ by: ['status'], where: { business_id, createdAt: { gte: startDate } }, _count: true }),
      prisma.job.groupBy({ by: ['type'], where: { business_id, createdAt: { gte: startDate } }, _count: true }),
    ]);

    res.json({
      period,
      total: jobs,
      by_status: byStatus.map((g) => ({ status: g.status, count: g._count })),
      by_type: byType.map((g) => ({ type: g.type, count: g._count })),
    });
  } catch (err) { next(err); }
}

module.exports = { getSummary, getWeeklyReport, getRevenueChart, getJobsAnalytics };
