/**
 * AI Event Log Service
 * Tracks all AI-driven actions for audit, debugging, and analytics.
 */
const prisma = require('../../lib/prisma');

async function getLogs({ business_id, event_type, job_id, customer_id, page = 1, limit = 50 }) {
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(200, Math.max(1, parseInt(limit) || 50));

  const where = { business_id };
  if (event_type) where.event_type = event_type;
  if (job_id) where.job_id = job_id;
  if (customer_id) where.customer_id = customer_id;

  const skip = (parsedPage - 1) * parsedLimit;
  const [data, total] = await Promise.all([
    prisma.aiEventLog.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: { timestamp: 'desc' },
      include: {
        job: { select: { id: true, title: true, status: true } },
        customer: { select: { id: true, first_name: true, last_name: true } },
      },
    }),
    prisma.aiEventLog.count({ where }),
  ]);

  return { data, total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) };
}

async function getById(id) {
  return prisma.aiEventLog.findUnique({
    where: { id },
    include: { job: true, customer: true },
  });
}

async function log(data) {
  return prisma.aiEventLog.create({
    data: {
      business_id: data.business_id,
      event_type: data.event_type,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      actor: data.actor || null,
      details: data.details || null,
      job_id: data.job_id || null,
      customer_id: data.customer_id || null,
      error: data.error || null,
    },
  });
}

async function getEventTypes(business_id) {
  const results = await prisma.aiEventLog.groupBy({
    by: ['event_type'],
    where: { business_id },
    _count: { event_type: true },
    orderBy: { _count: { event_type: 'desc' } },
  });
  return results.map((r) => ({ event_type: r.event_type, count: r._count.event_type }));
}

module.exports = { getLogs, getById, log, getEventTypes };
