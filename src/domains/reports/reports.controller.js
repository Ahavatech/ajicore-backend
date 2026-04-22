/**
 * Reports Controller
 */
const reportsService = require('./reports.service');

async function getKPIs(req, res, next) {
  try {
    const { business_id, timeframe = 'This Month' } = req.query;
    const kpis = await reportsService.getKPIs({ business_id, timeframe });
    res.json(kpis);
  } catch (err) { next(err); }
}

async function getFinancials(req, res, next) {
  try {
    const { business_id, year } = req.query;
    const financials = await reportsService.getFinancials({
      business_id,
      year: year ? parseInt(year) : new Date().getFullYear(),
    });
    res.json(financials);
  } catch (err) { next(err); }
}

async function getTopCustomers(req, res, next) {
  try {
    const { business_id, year } = req.query;
    const customers = await reportsService.getTopCustomers({
      business_id,
      year: year ? parseInt(year) : new Date().getFullYear(),
    });
    res.json(customers);
  } catch (err) { next(err); }
}

async function getTeamPerformance(req, res, next) {
  try {
    const { business_id, year } = req.query;
    const performance = await reportsService.getTeamPerformance({
      business_id,
      year: year ? parseInt(year) : new Date().getFullYear(),
    });
    res.json(performance);
  } catch (err) { next(err); }
}

module.exports = {
  getKPIs,
  getFinancials,
  getTopCustomers,
  getTeamPerformance,
};
