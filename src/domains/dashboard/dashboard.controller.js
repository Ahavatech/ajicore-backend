/**
 * Dashboard Controller
 * Summary metrics and analytics for the business dashboard.
 */
const { generateWeeklyReport } = require('../../utils/report_generator');
const dashboardService = require('./dashboard.service');

async function getSummary(req, res, next) {
  try {
    const { business_id, period } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    const summary = await dashboardService.getDashboardSummary(business_id, period);
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
    const { business_id, period } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    const revenue = await dashboardService.getRevenueChart(business_id, period);
    res.json(revenue);
  } catch (err) { next(err); }
}

async function getJobsAnalytics(req, res, next) {
  try {
    const { business_id, period } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    const analytics = await dashboardService.getJobsAnalytics(business_id, period);
    res.json(analytics);
  } catch (err) { next(err); }
}

module.exports = { getSummary, getWeeklyReport, getRevenueChart, getJobsAnalytics };
