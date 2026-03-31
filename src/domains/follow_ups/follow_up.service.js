/**
 * Follow-Up Service
 * Manages automated follow-ups for quotes and invoices.
 */
const prisma = require('../../lib/prisma');

async function getFollowUps({ business_id, type, status, page = 1, limit = 20 }) {
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const where = { business_id };
  if (type) where.type = type;
  if (status) where.status = status;

  const skip = (parsedPage - 1) * parsedLimit;
  const [data, total] = await Promise.all([
    prisma.followUp.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: { scheduled_for: 'asc' },
      include: { customer: { select: { id: true, first_name: true, last_name: true, phone_number: true } } },
    }),
    prisma.followUp.count({ where }),
  ]);

  return { data, total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) };
}

async function getById(id) {
  return prisma.followUp.findUnique({
    where: { id },
    include: { customer: true },
  });
}

async function create(data) {
  return prisma.followUp.create({
    data: {
      business_id: data.business_id,
      type: data.type,
      reference_id: data.reference_id,
      customer_id: data.customer_id || null,
      attempt_number: data.attempt_number || 1,
      scheduled_for: data.scheduled_for ? new Date(data.scheduled_for) : null,
      channel: data.channel || 'SMS',
      status: data.status || 'Scheduled',
      tone: data.tone || null,
    },
  });
}

async function update(id, data) {
  const updateData = {};
  const fields = ['status', 'sent_at', 'scheduled_for', 'attempt_number', 'tone', 'channel'];
  fields.forEach((f) => {
    if (data[f] !== undefined) {
      updateData[f] = (f === 'sent_at' || f === 'scheduled_for') && data[f] ? new Date(data[f]) : data[f];
    }
  });
  return prisma.followUp.update({ where: { id }, data: updateData });
}

async function markSent(id) {
  return prisma.followUp.update({
    where: { id },
    data: { status: 'Sent', sent_at: new Date() },
  });
}

async function cancel(id) {
  return prisma.followUp.update({
    where: { id },
    data: { status: 'Cancelled' },
  });
}

async function remove(id) {
  return prisma.followUp.delete({ where: { id } });
}

module.exports = { getFollowUps, getById, create, update, markSent, cancel, remove };
