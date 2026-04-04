/**
 * Report Generator Utility
 * Compiles business data into structured weekly/monthly reports.
 */
const prisma = require('../lib/prisma');

async function generateWeeklyReport(businessId, startDate, endDate) {
  const [jobs, quotes, invoices, payments, expenses, customers] = await Promise.all([
    prisma.job.findMany({
      where: { business_id: businessId, createdAt: { gte: startDate, lte: endDate } },
      include: { customer: true },
    }),
    prisma.quote.findMany({
      where: { business_id: businessId, createdAt: { gte: startDate, lte: endDate } },
    }),
    prisma.invoice.findMany({
      where: { job: { business_id: businessId }, createdAt: { gte: startDate, lte: endDate } },
      include: { line_items: true, payments: true },
    }),
    prisma.payment.findMany({
      where: { invoice: { job: { business_id: businessId } }, paid_at: { gte: startDate, lte: endDate } },
    }),
    prisma.expense.findMany({
      where: { business_id: businessId, date: { gte: startDate, lte: endDate } },
    }),
    prisma.customer.findMany({
      where: { business_id: businessId, createdAt: { gte: startDate, lte: endDate } },
    }),
  ]);

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const completedJobs = jobs.filter((j) => ['Completed', 'Invoiced'].includes(j.status)).length;

  // Top customers by job count
  const customerJobCounts = {};
  jobs.forEach((j) => {
    const key = j.customer_id;
    if (!customerJobCounts[key]) customerJobCounts[key] = { customer: j.customer, count: 0 };
    customerJobCounts[key].count++;
  });
  const topClients = Object.values(customerJobCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    period: { start: startDate, end: endDate },
    business_id: businessId,
    metrics: {
      total_jobs: jobs.length,
      completed_jobs: completedJobs,
      cancelled_jobs: jobs.filter((j) => j.status === 'Cancelled').length,
      new_quotes: quotes.length,
      converted_quotes: quotes.filter((q) => q.status === 'Approved').length,
      new_customers: customers.length,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_expenses: Math.round(totalExpenses * 100) / 100,
      net_profit: Math.round((totalRevenue - totalExpenses) * 100) / 100,
    },
    top_clients: topClients,
    generated_at: new Date().toISOString(),
  };
}

async function generateDashboardSummary(businessId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = new Date(now.setHours(0, 0, 0, 0));
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const [
    activeJobs, todayJobs, pendingQuotes, overdueInvoices,
    lowStockMaterials, vehicleAlerts, monthRevenue,
  ] = await Promise.all([
    prisma.job.count({ where: { business_id: businessId, status: { in: ['Scheduled', 'InProgress'] } } }),
    prisma.job.count({ where: { business_id: businessId, scheduled_start_time: { gte: today, lt: tomorrow } } }),
    prisma.quote.count({ where: { business_id: businessId, status: { in: ['EstimateScheduled', 'Sent', 'Draft'] } } }),
    prisma.invoice.count({ where: { job: { business_id: businessId }, status: 'Overdue' } }),
    prisma.material.findMany({ where: { business_id: businessId } }).then((mats) =>
      mats.filter((m) => m.quantity_on_hand <= m.restock_threshold).length
    ),
    prisma.vehicle.findMany({ where: { business_id: businessId } }).then((vehicles) => {
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      return vehicles.filter((v) => {
        const milesSince = v.mileage - v.last_maintenance_mileage;
        return milesSince >= v.maintenance_cycle_miles ||
          (v.insurance_expiry && v.insurance_expiry <= thirtyDays) ||
          (v.registration_renewal && v.registration_renewal <= thirtyDays);
      }).length;
    }),
    prisma.payment.findMany({
      where: { invoice: { job: { business_id: businessId } }, paid_at: { gte: startOfMonth } },
    }).then((ps) => ps.reduce((sum, p) => sum + p.amount, 0)),
  ]);

  return {
    active_jobs: activeJobs,
    todays_jobs: todayJobs,
    pending_quotes: pendingQuotes,
    overdue_invoices: overdueInvoices,
    low_stock_alerts: lowStockMaterials,
    vehicle_alerts: vehicleAlerts,
    month_revenue: Math.round(monthRevenue * 100) / 100,
  };
}

module.exports = { generateWeeklyReport, generateDashboardSummary };
