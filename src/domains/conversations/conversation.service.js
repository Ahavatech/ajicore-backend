const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { NotFoundError } = require('../../utils/errors');

function buildCustomerName(customer) {
  if (!customer) return 'Unknown Customer';
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return fullName || 'Unknown Customer';
}

function getChannel(eventType = '') {
  return eventType.startsWith('call.') ? 'call' : 'sms';
}

function buildActivityTitle(log) {
  const details = log.details && typeof log.details === 'object' ? log.details : {};
  return details.title || details.message || `${getChannel(log.event_type).toUpperCase()} activity`;
}

async function listConversations({ business_id, channel, search, page = 1, limit = 20 }) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const where = {
    business_id,
    customer_id: { not: null },
    OR: [
      { event_type: { startsWith: 'call.' } },
      { event_type: { startsWith: 'sms.' } },
    ],
  };

  if (channel === 'call') {
    where.OR = [{ event_type: { startsWith: 'call.' } }];
  } else if (channel === 'sms') {
    where.OR = [{ event_type: { startsWith: 'sms.' } }];
  }

  if (search) {
    where.customer = {
      OR: [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { phone_number: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const logs = await prisma.aiEventLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    include: {
      customer: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          email: true,
        },
      },
    },
  });

  const grouped = new Map();
  for (const log of logs) {
    if (!log.customer_id) continue;

    if (!grouped.has(log.customer_id)) {
      grouped.set(log.customer_id, {
        customer_id: log.customer_id,
        customer: {
          id: log.customer.id,
          name: buildCustomerName(log.customer),
          phone_number: log.customer.phone_number || '',
          email: log.customer.email || '',
        },
        latest_activity_title: buildActivityTitle(log),
        latest_timestamp: log.timestamp,
        total_events: 0,
        _counts: { call: 0, sms: 0 },
      });
    }

    const item = grouped.get(log.customer_id);
    const currentChannel = getChannel(log.event_type);
    item.total_events += 1;
    item._counts[currentChannel] += 1;
  }

  const allItems = Array.from(grouped.values())
    .map((item) => ({
      customer_id: item.customer_id,
      customer: item.customer,
      latest_activity_title: item.latest_activity_title,
      latest_timestamp: item.latest_timestamp,
      dominant_channel: item._counts.call >= item._counts.sms ? 'call' : 'sms',
      total_events: item.total_events,
    }))
    .sort((a, b) => new Date(b.latest_timestamp) - new Date(a.latest_timestamp));

  const total = allItems.length;
  const offset = (parsedPage - 1) * parsedLimit;

  return {
    data: allItems.slice(offset, offset + parsedLimit),
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit),
  };
}

async function getConversationByCustomer({ business_id, customer_id, channel }) {
  const customer = await prisma.customer.findFirst({
    where: { id: customer_id, business_id },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      phone_number: true,
      email: true,
    },
  });

  if (!customer) {
    throw new NotFoundError('Conversation');
  }

  const where = {
    business_id,
    customer_id,
    OR: [
      { event_type: { startsWith: 'call.' } },
      { event_type: { startsWith: 'sms.' } },
    ],
  };

  if (channel === 'call') {
    where.OR = [{ event_type: { startsWith: 'call.' } }];
  } else if (channel === 'sms') {
    where.OR = [{ event_type: { startsWith: 'sms.' } }];
  }

  const entries = await prisma.aiEventLog.findMany({
    where,
    orderBy: { timestamp: 'asc' },
  });

  return {
    customer: {
      id: customer.id,
      name: buildCustomerName(customer),
      phone_number: customer.phone_number || '',
      email: customer.email || '',
    },
    entries: entries.map((entry) => ({
      id: entry.id,
      channel: getChannel(entry.event_type),
      event_type: entry.event_type,
      title: buildActivityTitle(entry),
      actor: entry.actor || '',
      timestamp: entry.timestamp,
      error: entry.error || null,
      details: entry.details || {},
    })),
  };
}

module.exports = {
  listConversations,
  getConversationByCustomer,
};
