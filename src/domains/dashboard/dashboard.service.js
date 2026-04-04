/**
 * Dashboard Service
 * Builds frontend-ready dashboard responses from business data.
 */
const prisma = require('../../lib/prisma');
const { ValidationError } = require('../../utils/errors');

const PERIOD_TO_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const DEFAULT_PERIOD = '7d';
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_LIMIT = 10;

function parsePeriod(period = DEFAULT_PERIOD) {
  return PERIOD_TO_DAYS[period] ? period : DEFAULT_PERIOD;
}

function roundCurrency(value) {
  return Math.round((value || 0) * 100) / 100;
}

function roundTrend(value) {
  return Math.round(value * 10) / 10;
}

function calculateTrend(currentValue, previousValue) {
  if (!previousValue) {
    return currentValue === 0 ? 0 : 100;
  }

  return roundTrend(((currentValue - previousValue) / previousValue) * 100);
}

function getSafeTimezone(timezone) {
  if (!timezone) return 'UTC';

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch (_err) {
    return 'UTC';
  }
}

function getTimeZoneParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  return formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
}

function getTimeZoneOffset(date, timezone) {
  const parts = getTimeZoneParts(date, timezone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - date.getTime();
}

function zonedDateToUtc(parts, timezone) {
  const utcGuess = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour || 0),
    Number(parts.minute || 0),
    Number(parts.second || 0)
  ));

  const offset = getTimeZoneOffset(utcGuess, timezone);
  return new Date(utcGuess.getTime() - offset);
}

function shiftDateParts(parts, deltaDays) {
  const shifted = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  shifted.setUTCDate(shifted.getUTCDate() + deltaDays);

  return {
    year: shifted.getUTCFullYear(),
    month: `${shifted.getUTCMonth() + 1}`.padStart(2, '0'),
    day: `${shifted.getUTCDate()}`.padStart(2, '0'),
  };
}

function getTodayRange(timezone) {
  const safeTimezone = getSafeTimezone(timezone);
  const todayParts = getTimeZoneParts(new Date(), safeTimezone);
  const tomorrowParts = shiftDateParts(todayParts, 1);

  return {
    start: zonedDateToUtc({ ...todayParts, hour: 0, minute: 0, second: 0 }, safeTimezone),
    end: zonedDateToUtc({ ...tomorrowParts, hour: 0, minute: 0, second: 0 }, safeTimezone),
  };
}

function getCurrentAndPreviousRanges(period, timezone) {
  const days = PERIOD_TO_DAYS[parsePeriod(period)];
  const todayRange = getTodayRange(timezone);
  const currentStart = new Date(todayRange.start.getTime() - (days - 1) * DAY_MS);
  const currentEnd = new Date();
  const previousStart = new Date(currentStart.getTime() - days * DAY_MS);
  const previousEnd = new Date(currentStart);

  return { days, currentStart, currentEnd, previousStart, previousEnd };
}

function formatDateKey(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function buildDayBuckets(days, timezone) {
  const safeTimezone = getSafeTimezone(timezone);
  const todayParts = getTimeZoneParts(new Date(), safeTimezone);

  return Array.from({ length: days }, (_value, index) => {
    const dayParts = shiftDateParts(todayParts, index - (days - 1));
    const anchorDate = zonedDateToUtc({ ...dayParts, hour: 12, minute: 0, second: 0 }, safeTimezone);
    const label = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimezone,
      ...(days <= 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' }),
    }).format(anchorDate);

    return {
      key: formatDateKey(dayParts),
      name: label,
      value: 0,
    };
  });
}

function getDateKeyForTimezone(date, timezone) {
  const parts = getTimeZoneParts(date, timezone);
  return formatDateKey(parts);
}

function formatTime(date, timezone) {
  if (!date) return 'Time unavailable';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function humanizeToken(value = '') {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildCustomerName(customer) {
  if (!customer) return 'Unknown Customer';

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return fullName || 'Unknown Customer';
}

function buildJobType(jobLike) {
  return jobLike?.service_type || jobLike?.title || jobLike?.type || 'Service';
}

function buildQuoteIdentifier(quoteId) {
  return `EST-${String(quoteId || '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function getRelativeTime(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / (60 * 1000)));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function mapActivityType(eventType = '') {
  if (eventType.startsWith('call.')) return 'call';
  if (eventType.startsWith('sms.')) return 'sms';
  if (eventType.startsWith('invoice.')) return 'invoice';
  if (eventType.startsWith('schedule.')) return 'schedule';
  if (eventType.startsWith('quote.')) return 'schedule';
  return 'job';
}

function buildActivityTitle(entry) {
  const details = entry.details && typeof entry.details === 'object' ? entry.details : {};
  if (details.title) return details.title;
  if (details.message) return details.message;

  const customerName = buildCustomerName(entry.customer);
  const jobTitle = entry.job?.title || buildJobType(entry.job);

  if (entry.event_type.startsWith('call.')) return `Call activity for ${customerName}`;
  if (entry.event_type.startsWith('sms.')) return `SMS update for ${customerName}`;
  if (entry.event_type.startsWith('invoice.')) return `Invoice update for ${customerName}`;
  if (entry.event_type.startsWith('schedule.')) return `Schedule updated for ${jobTitle}`;
  if (entry.event_type.startsWith('quote.')) return `Quote update for ${customerName}`;
  return `Job update for ${jobTitle}`;
}

async function getBusinessContext(businessId) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, timezone: true },
  });

  if (!business) {
    throw new ValidationError('Business not found.');
  }

  return {
    id: business.id,
    timezone: getSafeTimezone(business.timezone),
  };
}

async function getRevenueMetrics(businessId, period = DEFAULT_PERIOD, timezone = 'UTC') {
  const normalizedPeriod = parsePeriod(period);
  const { days, currentStart, currentEnd, previousStart, previousEnd } = getCurrentAndPreviousRanges(normalizedPeriod, timezone);

  const [currentPayments, previousPayments] = await Promise.all([
    prisma.payment.findMany({
      where: {
        invoice: { job: { business_id: businessId } },
        paid_at: { gte: currentStart, lte: currentEnd },
      },
      select: { amount: true, paid_at: true },
      orderBy: { paid_at: 'asc' },
    }),
    prisma.payment.findMany({
      where: {
        invoice: { job: { business_id: businessId } },
        paid_at: { gte: previousStart, lt: previousEnd },
      },
      select: { amount: true },
    }),
  ]);

  const total = roundCurrency(currentPayments.reduce((sum, payment) => sum + payment.amount, 0));
  const previousTotal = roundCurrency(previousPayments.reduce((sum, payment) => sum + payment.amount, 0));
  const trend = calculateTrend(total, previousTotal);

  const buckets = buildDayBuckets(days, timezone);
  const amountByDay = new Map(buckets.map((bucket) => [bucket.key, 0]));

  for (const payment of currentPayments) {
    const key = getDateKeyForTimezone(payment.paid_at, timezone);
    amountByDay.set(key, roundCurrency((amountByDay.get(key) || 0) + payment.amount));
  }

  const chart_data = buckets.map((bucket) => ({
    name: bucket.name,
    value: roundCurrency(amountByDay.get(bucket.key) || 0),
  }));

  return { total, trend, chart_data };
}

async function getJobsTrend(businessId, period = DEFAULT_PERIOD, timezone = 'UTC') {
  const normalizedPeriod = parsePeriod(period);
  const { currentStart, currentEnd, previousStart, previousEnd } = getCurrentAndPreviousRanges(normalizedPeriod, timezone);

  const [currentCount, previousCount] = await Promise.all([
    prisma.job.count({
      where: {
        business_id: businessId,
        createdAt: { gte: currentStart, lte: currentEnd },
      },
    }),
    prisma.job.count({
      where: {
        business_id: businessId,
        createdAt: { gte: previousStart, lt: previousEnd },
      },
    }),
  ]);

  return calculateTrend(currentCount, previousCount);
}

async function getTodaysJobs(businessId, timezone) {
  const { start, end } = getTodayRange(timezone);
  const jobs = await prisma.job.findMany({
    where: {
      business_id: businessId,
      scheduled_start_time: { gte: start, lt: end },
    },
    include: {
      assigned_staff: { select: { name: true } },
    },
    orderBy: { scheduled_start_time: 'asc' },
  });

  return jobs.map((job) => ({
    id: job.id,
    time: formatTime(job.scheduled_start_time, timezone),
    technician: job.assigned_staff?.name || 'Unassigned',
    jobType: buildJobType(job),
    status: humanizeToken(job.status),
  }));
}

async function getPendingQuotes(businessId) {
  const quotes = await prisma.quote.findMany({
    where: {
      business_id: businessId,
      status: { in: ['EstimateScheduled', 'Draft', 'Sent'] },
    },
    include: {
      customer: {
        select: { first_name: true, last_name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return quotes.map((quote) => ({
    id: quote.id,
    customerName: buildCustomerName(quote.customer),
    jobType: quote.title || quote.description || 'Service Estimate',
    quoteId: buildQuoteIdentifier(quote.id),
  }));
}

function resolveLocation(job) {
  if (!job) return 'Location unavailable';
  return job.address || job.customer?.address || 'Location unavailable';
}

async function getActiveTeam(businessId, timezone) {
  const { start: todayStart, end: todayEnd } = getTodayRange(timezone);
  const now = new Date();

  const staffMembers = await prisma.staff.findMany({
    where: { business_id: businessId },
    include: {
      active_job: {
        include: {
          customer: { select: { address: true } },
        },
      },
      assigned_jobs: {
        where: { status: { in: ['Scheduled', 'InProgress'] } },
        orderBy: { scheduled_start_time: 'asc' },
        include: {
          customer: { select: { address: true } },
        },
      },
      timesheets: {
        where: { clock_out: null },
        orderBy: { clock_in: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });

  const statusRank = { 'On Job': 0, Traveling: 1, 'On Break': 2 };

  return staffMembers
    .map((staff) => {
      const inProgressJob = staff.assigned_jobs.find((job) => job.status === 'InProgress');
      const activeJob = staff.active_job || inProgressJob || null;
      const nextScheduledJob = staff.assigned_jobs.find((job) =>
        job.status === 'Scheduled' &&
        job.scheduled_start_time &&
        job.scheduled_start_time >= now &&
        job.scheduled_start_time >= todayStart &&
        job.scheduled_start_time < todayEnd
      );
      const openTimesheet = staff.timesheets.length > 0;

      let status = null;
      let location = 'Location unavailable';

      if (activeJob) {
        status = 'On Job';
        location = resolveLocation(activeJob);
      } else if (nextScheduledJob) {
        status = 'Traveling';
        location = resolveLocation(nextScheduledJob);
      } else if (openTimesheet) {
        status = 'On Break';
      }

      if (!status) return null;

      return {
        id: staff.id,
        name: staff.name,
        role: humanizeToken(staff.role),
        status,
        location,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (statusRank[a.status] !== statusRank[b.status]) {
        return statusRank[a.status] - statusRank[b.status];
      }

      return a.name.localeCompare(b.name);
    });
}

async function getRecentActivity(businessId) {
  const activity = await prisma.aiEventLog.findMany({
    where: {
      business_id: businessId,
      OR: [
        { event_type: { startsWith: 'call.' } },
        { event_type: { startsWith: 'sms.' } },
        { event_type: { startsWith: 'job.' } },
        { event_type: { startsWith: 'invoice.' } },
        { event_type: { startsWith: 'schedule.' } },
        { event_type: { startsWith: 'quote.' } },
      ],
    },
    include: {
      job: { select: { id: true, title: true, service_type: true, type: true } },
      customer: { select: { first_name: true, last_name: true } },
    },
    orderBy: { timestamp: 'desc' },
    take: ACTIVITY_LIMIT,
  });

  return activity.map((entry) => ({
    type: mapActivityType(entry.event_type),
    title: buildActivityTitle(entry),
    time: getRelativeTime(entry.timestamp || entry.createdAt || new Date()),
  }));
}

async function getDashboardSummary(businessId, period = DEFAULT_PERIOD) {
  const business = await getBusinessContext(businessId);
  const { currentStart, currentEnd } = getCurrentAndPreviousRanges(period, business.timezone);
  const [revenueMetrics, jobsTrend, activeJobs, pendingInvoices, overdueInvoices, callsHandled, todaysJobs, pendingQuotes, recentActivity, activeTeam] = await Promise.all([
    getRevenueMetrics(businessId, period, business.timezone),
    getJobsTrend(businessId, period, business.timezone),
    prisma.job.count({
      where: {
        business_id: businessId,
        status: { in: ['Scheduled', 'InProgress'] },
      },
    }),
    prisma.invoice.count({
      where: {
        job: { business_id: businessId },
        status: { in: ['Sent', 'PartiallyPaid', 'Overdue'] },
      },
    }),
    prisma.invoice.count({
      where: {
        job: { business_id: businessId },
        status: 'Overdue',
      },
    }),
    prisma.aiEventLog.count({
      where: {
        business_id: businessId,
        event_type: { startsWith: 'call.' },
        timestamp: { gte: currentStart, lte: currentEnd },
      },
    }),
    getTodaysJobs(businessId, business.timezone),
    getPendingQuotes(businessId),
    getRecentActivity(businessId),
    getActiveTeam(businessId, business.timezone),
  ]);

  return {
    revenue: revenueMetrics.total,
    active_jobs: activeJobs,
    jobs_trend: jobsTrend,
    pending_invoices: pendingInvoices,
    overdue_invoices: overdueInvoices,
    calls_handled: callsHandled,
    todays_jobs: todaysJobs,
    pending_quotes: pendingQuotes,
    recent_activity: recentActivity,
    active_team: activeTeam,
  };
}

async function getRevenueChart(businessId, period = DEFAULT_PERIOD) {
  const business = await getBusinessContext(businessId);
  return getRevenueMetrics(businessId, period, business.timezone);
}

async function getJobsAnalytics(businessId, period = DEFAULT_PERIOD) {
  const business = await getBusinessContext(businessId);
  const normalizedPeriod = parsePeriod(period);
  const { currentStart, currentEnd } = getCurrentAndPreviousRanges(normalizedPeriod, business.timezone);

  const [jobs, byStatus, byType, jobsForChart] = await Promise.all([
    prisma.job.count({
      where: {
        business_id: businessId,
        createdAt: { gte: currentStart, lte: currentEnd },
      },
    }),
    prisma.job.groupBy({
      by: ['status'],
      where: {
        business_id: businessId,
        createdAt: { gte: currentStart, lte: currentEnd },
      },
      _count: { status: true },
    }),
    prisma.job.groupBy({
      by: ['type'],
      where: {
        business_id: businessId,
        createdAt: { gte: currentStart, lte: currentEnd },
      },
      _count: { type: true },
    }),
    prisma.job.findMany({
      where: {
        business_id: businessId,
        createdAt: { gte: currentStart, lte: currentEnd },
      },
      select: {
        title: true,
        service_type: true,
        type: true,
      },
    }),
  ]);

  const groupedChart = jobsForChart.reduce((acc, job) => {
    const key = buildJobType(job);
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());

  const chart_data = Array.from(groupedChart.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  return {
    period: normalizedPeriod,
    total: jobs,
    by_status: byStatus.map((group) => ({ status: group.status, count: group._count.status })),
    by_type: byType.map((group) => ({ type: group.type, count: group._count.type })),
    chart_data,
  };
}

module.exports = {
  DEFAULT_PERIOD,
  parsePeriod,
  getDashboardSummary,
  getRevenueChart,
  getJobsAnalytics,
};
