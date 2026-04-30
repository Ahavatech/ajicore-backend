/**
 * AI Chat Service
 * Builds a business-scoped assistant reply for the frontend chat widget.
 */
const prisma = require('../../lib/prisma');
const searchService = require('../search/search.service');
const { NotFoundError, ValidationError } = require('../../utils/errors');

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_CONTENT_LENGTH = 2000;

function normalizeText(value, fieldName) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError(`${fieldName} cannot be empty.`);
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError(`${fieldName} must be ${MAX_MESSAGE_LENGTH} characters or less.`);
  }

  return trimmed;
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) {
    throw new ValidationError('history must be an array.');
  }

  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new ValidationError(`history[${index}] must be an object.`);
      }

      const role = typeof entry.role === 'string' ? entry.role.trim() : '';
      const content = typeof entry.content === 'string' ? entry.content.trim() : '';

      if (!['system', 'user', 'assistant'].includes(role)) {
        throw new ValidationError(`history[${index}].role must be one of: system, user, assistant.`);
      }

      if (!content) {
        throw new ValidationError(`history[${index}].content cannot be empty.`);
      }

      return {
        role,
        content: content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
      };
    });
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

function formatTime(date, timezone) {
  if (!date) return null;

  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

function buildPersonName(firstName, lastName, fallback = 'there') {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || fallback;
}

function buildCustomerName(customer) {
  if (!customer) return 'the customer';

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return fullName || customer.company_name || 'the customer';
}

function buildSystemPrompt({ business, user, staffName }) {
  const userName = buildPersonName(user.first_name, user.last_name, user.email || 'User');
  const role = user.role || 'admin';

  return [
    `You are the AjiCore Assistant for ${business.name}.`,
    `Only use data scoped to business_id ${business.id}.`,
    `The authenticated user is ${userName} with role ${role}.`,
    staffName ? `Their staff profile name is ${staffName}.` : null,
    business.industry ? `Business industry: ${business.industry}.` : null,
    business.timezone ? `Business timezone: ${business.timezone}.` : null,
    'Reply briefly, clearly, and never expose internal implementation details.',
  ].filter(Boolean).join(' ');
}

function detectIntent(message) {
  const normalized = message.toLowerCase();

  if (/(schedule|dispatch|appointment|calendar|today|tomorrow|next job|next estimate)/.test(normalized)) {
    return 'schedule';
  }
  if (/(quote|estimate|proposal)/.test(normalized)) {
    return 'quotes';
  }
  if (/(invoice|payment|paid|overdue|balance)/.test(normalized)) {
    return 'billing';
  }
  if (/(inventory|material|stock|restock|low stock|supplies)/.test(normalized)) {
    return 'inventory';
  }

  return 'search';
}

async function getBusinessContext(businessId, userId) {
  const [business, user] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        industry: true,
        timezone: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        business_id: true,
        staff_id: true,
        staff_profile: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  if (!business) {
    throw new NotFoundError('Business');
  }

  if (!user) {
    throw new NotFoundError('User');
  }

  return {
    business,
    user,
    timezone: getSafeTimezone(business.timezone),
  };
}

async function buildScheduleReply({ businessId, user, timezone }) {
  const { start, end } = getTodayRange(timezone);
  const staffScopedWhere = user.role === 'staff' && user.staff_id
    ? { assigned_staff_id: user.staff_id }
    : {};

  const [jobs, quotes] = await Promise.all([
    prisma.job.findMany({
      where: {
        business_id: businessId,
        scheduled_start_time: { gte: start, lt: end },
        ...staffScopedWhere,
      },
      select: {
        id: true,
        title: true,
        service_type: true,
        address: true,
        status: true,
        scheduled_start_time: true,
        customer: {
          select: {
            first_name: true,
            last_name: true,
            company_name: true,
            address: true,
          },
        },
      },
      orderBy: { scheduled_start_time: 'asc' },
      take: 10,
    }),
    prisma.quote.findMany({
      where: {
        business_id: businessId,
        OR: [
          { scheduled_start_time: { gte: start, lt: end } },
          { scheduled_estimate_date: { gte: start, lt: end } },
        ],
        ...staffScopedWhere,
      },
      select: {
        id: true,
        title: true,
        service_name: true,
        status: true,
        scheduled_start_time: true,
        scheduled_estimate_date: true,
        customer: {
          select: {
            first_name: true,
            last_name: true,
            company_name: true,
            address: true,
          },
        },
      },
      orderBy: { scheduled_start_time: 'asc' },
      take: 10,
    }),
  ]);

  const appointments = [
    ...jobs.map((job) => ({
      type: 'job',
      title: job.title || job.service_type || 'Untitled job',
      when: job.scheduled_start_time,
      address: job.address || job.customer?.address || null,
      customerName: buildCustomerName(job.customer),
      status: job.status,
    })),
    ...quotes.map((quote) => ({
      type: 'estimate',
      title: quote.title || quote.service_name || 'Untitled estimate',
      when: quote.scheduled_start_time || quote.scheduled_estimate_date,
      address: quote.customer?.address || null,
      customerName: buildCustomerName(quote.customer),
      status: quote.status,
    })),
  ]
    .filter((item) => item.when)
    .sort((a, b) => new Date(a.when) - new Date(b.when));

  if (appointments.length === 0) {
    return 'You have no appointments scheduled for today.';
  }

  const next = appointments[0];
  const jobsCount = appointments.filter((item) => item.type === 'job').length;
  const estimatesCount = appointments.filter((item) => item.type === 'estimate').length;
  const parts = [
    `You have ${appointments.length} appointment${appointments.length === 1 ? '' : 's'} scheduled for today.`,
    `That includes ${jobsCount} job${jobsCount === 1 ? '' : 's'} and ${estimatesCount} estimate${estimatesCount === 1 ? '' : 's'}.`,
    `Your next dispatch is ${next.type === 'estimate' ? 'an estimate' : 'a job'} at ${formatTime(next.when, timezone)} for ${next.customerName}.`,
  ];

  if (next.address) {
    parts.push(`The address is ${next.address}.`);
  }

  return parts.join(' ');
}

async function buildQuotesReply({ businessId, user, timezone }) {
  const staffScopedWhere = user.role === 'staff' && user.staff_id
    ? { assigned_staff_id: user.staff_id }
    : {};

  const [counts, nextEstimate] = await Promise.all([
    prisma.quote.groupBy({
      by: ['status'],
      where: {
        business_id: businessId,
        ...staffScopedWhere,
      },
      _count: { status: true },
    }),
    prisma.quote.findFirst({
      where: {
        business_id: businessId,
        status: { in: ['EstimateScheduled', 'Draft', 'Sent'] },
        ...staffScopedWhere,
      },
      select: {
        title: true,
        service_name: true,
        scheduled_start_time: true,
        scheduled_estimate_date: true,
        customer: {
          select: {
            first_name: true,
            last_name: true,
            company_name: true,
          },
        },
      },
      orderBy: [
        { scheduled_start_time: 'asc' },
        { scheduled_estimate_date: 'asc' },
        { createdAt: 'asc' },
      ],
    }),
  ]);

  const total = counts.reduce((sum, item) => sum + item._count.status, 0);
  const sent = counts.find((item) => item.status === 'Sent')?._count.status || 0;
  const drafts = counts.find((item) => item.status === 'Draft')?._count.status || 0;
  const scheduled = counts.find((item) => item.status === 'EstimateScheduled')?._count.status || 0;

  if (total === 0) {
    return 'There are no quotes or estimate appointments matching your current scope.';
  }

  const parts = [
    `You currently have ${total} quote-related record${total === 1 ? '' : 's'} in scope.`,
    `${scheduled} estimate appointment${scheduled === 1 ? '' : 's'}, ${drafts} draft${drafts === 1 ? '' : 's'}, and ${sent} sent quote${sent === 1 ? '' : 's'}.`,
  ];

  if (nextEstimate) {
    const when = nextEstimate.scheduled_start_time || nextEstimate.scheduled_estimate_date;
    const title = nextEstimate.title || nextEstimate.service_name || 'the next estimate';
    parts.push(`Next up is ${title} for ${buildCustomerName(nextEstimate.customer)}${when ? ` at ${formatTime(when, timezone)}` : ''}.`);
  }

  return parts.join(' ');
}

async function buildBillingReply({ businessId }) {
  const [overdueCount, unpaidCount, lastPaidInvoice] = await Promise.all([
    prisma.invoice.count({
      where: {
        business_id: businessId,
        status: 'Overdue',
      },
    }),
    prisma.invoice.count({
      where: {
        business_id: businessId,
        status: { in: ['Draft', 'Sent', 'PartiallyPaid', 'Overdue'] },
      },
    }),
    prisma.invoice.findFirst({
      where: {
        business_id: businessId,
        status: 'Paid',
      },
      select: {
        id: true,
        total_amount: true,
        paid_at: true,
        customer: {
          select: {
            first_name: true,
            last_name: true,
            company_name: true,
          },
        },
      },
      orderBy: { paid_at: 'desc' },
    }),
  ]);

  const parts = [
    `You have ${unpaidCount} open invoice${unpaidCount === 1 ? '' : 's'} and ${overdueCount} overdue invoice${overdueCount === 1 ? '' : 's'}.`,
  ];

  if (lastPaidInvoice) {
    const amount = Number(lastPaidInvoice.total_amount || 0).toFixed(2);
    parts.push(`The most recently paid invoice was for ${buildCustomerName(lastPaidInvoice.customer)} at $${amount}.`);
  }

  return parts.join(' ');
}

async function buildInventoryReply({ businessId }) {
  const lowStock = await prisma.material.findMany({
    where: {
      business_id: businessId,
      quantity_on_hand: { lte: prisma.material.fields.restock_threshold },
    },
    select: {
      name: true,
      quantity_on_hand: true,
      restock_threshold: true,
      unit: true,
    },
    orderBy: [
      { quantity_on_hand: 'asc' },
      { name: 'asc' },
    ],
    take: 5,
  });

  if (lowStock.length === 0) {
    return 'Inventory looks healthy right now. Nothing is currently at or below its restock threshold.';
  }

  const summary = lowStock
    .map((item) => `${item.name} (${item.quantity_on_hand}${item.unit ? ` ${item.unit}` : ''} on hand, threshold ${item.restock_threshold})`)
    .join(', ');

  return `You have ${lowStock.length} low-stock material${lowStock.length === 1 ? '' : 's'} right now: ${summary}.`;
}

function flattenSearchResults(results) {
  return Object.entries(results || {})
    .filter(([, items]) => Array.isArray(items) && items.length > 0)
    .map(([type, items]) => ({ type, items }));
}

async function buildSearchReply({ businessId, message }) {
  const search = await searchService.globalSearch({
    business_id: businessId,
    q: message,
    limit: 3,
  });

  const groups = flattenSearchResults(search.results);
  if (groups.length === 0) {
    return 'I could not find a direct match in your business data. Try asking about schedule, quotes, invoices, or inventory with a little more detail.';
  }

  const summary = groups
    .map((group) => `${group.items.length} ${group.type}`)
    .join(', ');
  const topMatch = groups[0].items[0];

  return `I found matching business records: ${summary}. The top match is ${topMatch.title}${topMatch.subtitle ? ` (${topMatch.subtitle})` : ''}.`;
}

async function buildReply({ businessId, user, timezone, message }) {
  const intent = detectIntent(message);

  if (intent === 'schedule') {
    return buildScheduleReply({ businessId, user, timezone });
  }
  if (intent === 'quotes') {
    return buildQuotesReply({ businessId, user, timezone });
  }
  if (intent === 'billing') {
    return buildBillingReply({ businessId });
  }
  if (intent === 'inventory') {
    return buildInventoryReply({ businessId });
  }

  return buildSearchReply({ businessId, message });
}

async function chat({ business_id, message, history, requestUser }) {
  if (!requestUser?.id) {
    throw new ValidationError('Authenticated user context is required.');
  }

  const cleanMessage = normalizeText(message, 'message');
  const cleanHistory = sanitizeHistory(history);
  const { business, user, timezone } = await getBusinessContext(business_id, requestUser.id);
  const systemPrompt = buildSystemPrompt({
    business,
    user,
    staffName: user.staff_profile?.name || null,
  });

  const context_messages = [
    { role: 'system', content: systemPrompt },
    ...cleanHistory,
    { role: 'user', content: cleanMessage },
  ];

  const reply = await buildReply({
    businessId: business.id,
    user,
    timezone,
    message: cleanMessage,
    history: cleanHistory,
  });

  return {
    reply,
    context_messages,
  };
}

module.exports = {
  chat,
};
