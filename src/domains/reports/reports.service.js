/**
 * Reports Service
 * Business logic for reports, analytics, and KPI aggregation.
 */
const prisma = require('../../lib/prisma');

const REPORT_SERVICE_KEYS = ['plumbing', 'electrical', 'cleaning', 'security', 'hvac'];

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function roundTrend(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function normalizeServiceKey(serviceType) {
  const normalized = String(serviceType || '').trim().toLowerCase();
  return REPORT_SERVICE_KEYS.includes(normalized) ? normalized : 'hvac';
}

function getJobRevenue(job) {
  return (job.invoices || []).reduce((jobSum, invoice) => {
    return jobSum + (invoice.payments || []).reduce((paySum, payment) => paySum + payment.amount, 0);
  }, 0);
}

async function getKPIs({ business_id, timeframe = 'This Month' }) {
  let startDate = new Date();
  
  if (timeframe === 'Today') {
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === 'This Month') {
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
  }

  const jobs = await prisma.job.findMany({
    where: {
      business_id,
      createdAt: { gte: startDate },
    },
    include: { invoices: { include: { payments: true } } },
  });

  const customers = await prisma.customer.findMany({
    where: {
      business_id,
      createdAt: { gte: startDate },
    },
  });

  // Calculate metrics
  const totalRevenue = jobs.reduce((sum, job) => {
    const revenue = job.invoices.reduce((jobSum, invoice) => {
      const paid = invoice.payments.reduce((paySum, payment) => paySum + payment.amount, 0);
      return jobSum + paid;
    }, 0);
    return sum + revenue;
  }, 0);

  const totalJobs = jobs.length;
  const newCustomers = customers.length;
  const avgJobValue = totalJobs > 0 ? totalRevenue / totalJobs : 0;

  // Calculate trends (comparing to previous period)
  let previousStartDate = new Date(startDate);
  if (timeframe === 'Today') {
    previousStartDate.setDate(previousStartDate.getDate() - 1);
  } else if (timeframe === 'This Month') {
    previousStartDate.setMonth(previousStartDate.getMonth() - 1);
  }

  const previousJobs = await prisma.job.findMany({
    where: {
      business_id,
      createdAt: { gte: previousStartDate, lt: startDate },
    },
    include: { invoices: { include: { payments: true } } },
  });

  const previousRevenue = previousJobs.reduce((sum, job) => {
    const revenue = job.invoices.reduce((jobSum, invoice) => {
      const paid = invoice.payments.reduce((paySum, payment) => paySum + payment.amount, 0);
      return jobSum + paid;
    }, 0);
    return sum + revenue;
  }, 0);

  const revenueTrend = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
  const jobsTrend = previousJobs.length > 0 ? ((totalJobs - previousJobs.length) / previousJobs.length) * 100 : 0;
  const previousCustomers = await prisma.customer.count({
    where: {
      business_id,
      createdAt: { gte: previousStartDate, lt: startDate },
    },
  });
  const customersTrend = previousCustomers > 0 ? ((newCustomers - previousCustomers) / previousCustomers) * 100 : 0;
  const previousAvgJobValue = previousJobs.length > 0 ? previousRevenue / previousJobs.length : 0;
  const avgJobValueTrend = previousAvgJobValue > 0
    ? ((avgJobValue - previousAvgJobValue) / previousAvgJobValue) * 100
    : 0;

  return {
    revenue: roundMoney(totalRevenue),
    revenueTrend: roundTrend(revenueTrend),
    jobs: totalJobs,
    jobsTrend: roundTrend(jobsTrend),
    newCustomers,
    customersTrend: roundTrend(customersTrend),
    avgJobValue: roundMoney(avgJobValue),
    avgJobValueTrend: roundTrend(avgJobValueTrend),
  };
}

async function getFinancials({ business_id, year = new Date().getFullYear() }) {
  const months = [];

  for (let month = 0; month < 12; month++) {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

    const jobs = await prisma.job.findMany({
      where: {
        business_id,
        status: { in: ['Completed', 'Invoiced'] },
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      include: { invoices: { include: { payments: true } } },
    });

    const revenueBreakdown = REPORT_SERVICE_KEYS.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    const jobsCount = REPORT_SERVICE_KEYS.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    const revenue = jobs.reduce((sum, job) => {
      const jobRevenue = getJobRevenue(job);
      const serviceKey = normalizeServiceKey(job.service_type);
      revenueBreakdown[serviceKey] += jobRevenue;
      jobsCount[serviceKey] += 1;
      return sum + jobRevenue;
    }, 0);

    const expenses = await prisma.expense.findMany({
      where: {
        business_id,
        date: { gte: monthStart, lte: monthEnd },
      },
    });

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const profit = revenue - totalExpenses;

    const expensesByCategory = expenses.reduce((acc, exp) => {
      const name = String(exp.category || 'Other').replace(/([A-Z])/g, ' $1').trim();
      acc[name] = (acc[name] || 0) + exp.amount;
      return acc;
    }, {});
    const expensesList = Object.entries(expensesByCategory).map(([name, amount]) => ({
      name,
      amount: -roundMoney(amount),
    }));

    const monthBreakdown = {
      revenue: Object.fromEntries(Object.entries(revenueBreakdown).map(([key, amount]) => [key, roundMoney(amount)])),
      expensesList,
      jobsCount,
    };

    months.push({
      month: monthStart.toLocaleString('default', { month: 'short' }),
      revenue: roundMoney(revenue),
      expenses: -roundMoney(totalExpenses),
      profit: roundMoney(profit),
      breakdown: monthBreakdown,
    });
  }

  return months;
}

async function getTopCustomers({ business_id, year = new Date().getFullYear() }) {
  const customers = await prisma.customer.findMany({
    where: { business_id },
    include: {
      jobs: {
        where: {
          status: { in: ['Completed', 'Invoiced'] },
          createdAt: {
            gte: new Date(year, 0, 1),
            lte: new Date(year, 11, 31),
          },
        },
        include: {
          invoices: {
            include: { payments: true },
          },
        },
      },
    },
  });

  return customers
    .map(c => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`.trim(),
      company: c.company_name || '',
      revenue: Math.round(
        c.jobs.reduce((sum, job) => {
          return sum + job.invoices.reduce((jobSum, invoice) => {
            return jobSum + invoice.payments.reduce((paySum, payment) => paySum + payment.amount, 0);
          }, 0);
        }, 0) * 100
      ) / 100,
      jobsCount: c.jobs.length,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

async function getTeamPerformance({ business_id, year = new Date().getFullYear() }) {
  const staff = await prisma.staff.findMany({
    where: { business_id },
    include: {
      assigned_jobs: {
        where: {
          status: { in: ['Completed', 'Invoiced'] },
          createdAt: {
            gte: new Date(year, 0, 1),
            lte: new Date(year, 11, 31),
          },
        },
        include: {
          invoices: {
            include: { payments: true },
          },
          timesheets: true,
        },
      },
    },
  });

  return staff
    .map(s => ({
      id: s.id,
      name: s.name,
      revenue: Math.round(
        s.assigned_jobs.reduce((sum, job) => {
          return sum + job.invoices.reduce((jobSum, invoice) => {
            return jobSum + invoice.payments.reduce((paySum, payment) => paySum + payment.amount, 0);
          }, 0);
        }, 0) * 100
      ) / 100,
      jobsCompleted: s.assigned_jobs.length,
      hoursWorked: Math.round(
        s.assigned_jobs.reduce((sum, job) => {
          return sum + job.timesheets.reduce((jobSum, ts) => jobSum + (ts.total_hours || 0), 0);
        }, 0) * 100
      ) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

module.exports = {
  getKPIs,
  getFinancials,
  getTopCustomers,
  getTeamPerformance,
};
