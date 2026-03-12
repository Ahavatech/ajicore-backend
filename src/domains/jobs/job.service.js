/**
 * Job Service
 * Business logic for job CRUD operations and status transitions.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getJobs({ business_id, status, page = 1, limit = 20 }) {
  const where = {};
  if (business_id) where.business_id = business_id;
  if (status) where.status = status;

  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      skip,
      take: limit,
      include: { customer: true, assigned_staff: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.job.count({ where }),
  ]);

  return { data: jobs, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getJobById(id) {
  return prisma.job.findUnique({
    where: { id },
    include: {
      customer: true,
      assigned_staff: true,
      quote_invoices: true,
      job_materials: { include: { material: true } },
      expenses: true,
    },
  });
}

async function createJob(data) {
  return prisma.job.create({
    data: {
      business_id: data.business_id,
      customer_id: data.customer_id,
      assigned_staff_id: data.assigned_staff_id || null,
      status: data.status || 'Pending',
      scheduled_start_time: data.scheduled_start_time ? new Date(data.scheduled_start_time) : null,
      scheduled_end_time: data.scheduled_end_time ? new Date(data.scheduled_end_time) : null,
      job_details: data.job_details || null,
    },
    include: { customer: true, assigned_staff: true },
  });
}

async function updateJob(id, data) {
  const updateData = {};
  if (data.assigned_staff_id !== undefined) updateData.assigned_staff_id = data.assigned_staff_id;
  if (data.status) updateData.status = data.status;
  if (data.scheduled_start_time) updateData.scheduled_start_time = new Date(data.scheduled_start_time);
  if (data.scheduled_end_time) updateData.scheduled_end_time = new Date(data.scheduled_end_time);
  if (data.job_details !== undefined) updateData.job_details = data.job_details;

  return prisma.job.update({
    where: { id },
    data: updateData,
    include: { customer: true, assigned_staff: true },
  });
}

async function deleteJob(id) {
  return prisma.job.delete({ where: { id } });
}

module.exports = { getJobs, getJobById, createJob, updateJob, deleteJob };