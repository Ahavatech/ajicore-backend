/**
 * Team Check-In Service
 * Manages scheduled staff check-ins and escalations.
 */
const prisma = require('../../lib/prisma');

async function getCheckins({ business_id, job_id, staff_id, status, page = 1, limit = 20 }) {
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const where = {
    staff: { business_id },
  };
  if (job_id) where.job_id = job_id;
  if (staff_id) where.staff_id = staff_id;
  if (status) where.status = status;

  const skip = (parsedPage - 1) * parsedLimit;
  const [data, total] = await Promise.all([
    prisma.teamCheckin.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: { scheduled_at: 'desc' },
      include: {
        staff: { select: { id: true, name: true, role: true, phone: true } },
        job: { select: { id: true, title: true, status: true } },
      },
    }),
    prisma.teamCheckin.count({ where }),
  ]);

  return { data, total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) };
}

async function getById(id) {
  return prisma.teamCheckin.findUnique({
    where: { id },
    include: {
      staff: true,
      job: true,
    },
  });
}

async function create(data) {
  return prisma.teamCheckin.create({
    data: {
      job_id: data.job_id || null,
      staff_id: data.staff_id,
      scheduled_at: new Date(data.scheduled_at),
      message: data.message || null,
      status: 'Pending',
    },
  });
}

async function receive(id, message) {
  return prisma.teamCheckin.update({
    where: { id },
    data: {
      status: 'Received',
      received_at: new Date(),
      message: message || undefined,
    },
  });
}

async function escalate(id) {
  return prisma.teamCheckin.update({
    where: { id },
    data: {
      status: 'Escalated',
      escalated: true,
      escalated_at: new Date(),
    },
  });
}

async function update(id, data) {
  const updateData = {};
  const fields = ['status', 'message', 'received_at', 'escalated', 'escalated_at'];
  fields.forEach((f) => {
    if (data[f] !== undefined) updateData[f] = data[f];
  });
  return prisma.teamCheckin.update({ where: { id }, data: updateData });
}

async function remove(id) {
  return prisma.teamCheckin.delete({ where: { id } });
}

module.exports = { getCheckins, getById, create, receive, escalate, update, remove };
