/**
 * Reports Service
 * Business logic for reports, analytics, and KPI aggregation.
 */
const prisma = require('../../lib/prisma');

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
  const avgJobValueTrend = previousJobs.length > 0 
    ? ((avgJobValue - (previousRevenue / previousJobs.length)) / (previousRevenue / previousJobs.length)) * 100 
    : 0;

  return {
    revenue: Math.round(totalRevenue * 100) / 100,
    revenueTrend: Math.round(revenueTrend * 10) / 10,
    jobs: totalJobs,
    jobsTrend: Math.round(jobsTrend * 10) / 10,
    newCustomers,
    customersTrend: Math.round(customersTrend * 10) / 10,
    avgJobValue: Math.round(avgJobValue * 100) / 100,
    avgJobValueTrend: Math.round(avgJobValueTrend * 10) / 10,
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

    const revenue = jobs.reduce((sum, job) => {
      return sum + job.invoices.reduce((jobSum, invoice) => {
        return jobSum + invoice.payments.reduce((paySum, payment) => paySum + payment.amount, 0);
      }, 0);
    }, 0);

    const expenses = await prisma.expense.findMany({
      where: {
        business_id,
        date: { gte: monthStart, lte: monthEnd },
      },
    });

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const profit = revenue - totalExpenses;

    // Mock breakdown - in production, this should come from categorization
    const monthBreakdown = {
      revenue: {
        plumbing: Math.floor(revenue * 0.25),
        electrical: Math.floor(revenue * 0.2),
        cleaning: Math.floor(revenue * 0.15),
        security: Math.floor(revenue * 0.15),
        hvac: Math.floor(revenue * 0.25),
      },
      expensesList: [
        { name: 'Payroll & Wages', amount: -Math.floor(totalExpenses * 0.5) },
        { name: 'Materials & Equipment', amount: -Math.floor(totalExpenses * 0.3) },
        { name: 'Fleet & Fuel', amount: -Math.floor(totalExpenses * 0.2) },
      ],
      jobsCount: {
        hvac: Math.floor(jobs.length * 0.25),
        plumbing: Math.floor(jobs.length * 0.25),
        electrical: Math.floor(jobs.length * 0.2),
        cleaning: Math.floor(jobs.length * 0.15),
        security: Math.floor(jobs.length * 0.15),
      },
    };

    months.push({
      month: monthStart.toLocaleString('default', { month: 'short' }),
      revenue: Math.round(revenue * 100) / 100,
      expenses: -Math.round(totalExpenses * 100) / 100,
      profit: Math.round(profit * 100) / 100,
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
