/**
 * Job Service
 * Business logic for job CRUD, status transitions, and time tracking.
 * Jobs: Scheduled → InProgress → Completed → Invoiced
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');

async function getJobs({ business_id, status, type, customer_id, page = 1, limit = 20 }) {
  const where = {};
  if (business_id) where.business_id = business_id;
  if (status) where.status = status;
  if (type) where.type = type;
  if (customer_id) where.customer_id = customer_id;

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    prisma.job.findMany({
      where, skip, take: limit,
      include: {
        customer: true,
        assigned_staff: true,
        invoices: { include: { line_items: true, payments: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { scheduled_start_time: 'asc' },
    }),
    prisma.job.count({ where }),
  ]);
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getJobById(id) {
  return prisma.job.findUnique({
    where: { id },
    include: {
      customer: true,
      assigned_staff: true,
      invoices: { include: { line_items: true, payments: true, edit_logs: true } },
      job_materials: { include: { material: true } },
      expenses: true,
      timesheets: { include: { staff: true } },
    },
  });
}

async function createJob(data) {
  const job = await prisma.job.create({
    data: {
      business_id: data.business_id,
      customer_id: data.customer_id,
      assigned_staff_id: data.assigned_staff_id || null,
      type: data.type || 'Job',
      status: data.status || 'Scheduled',
      title: data.title || null,
      job_details: data.job_details || null,
      price_book_item_id: data.price_book_item_id || null,
      service_call_fee: data.service_call_fee ?? null,
      scheduled_start_time: data.scheduled_start_time ? new Date(data.scheduled_start_time) : null,
      scheduled_end_time: data.scheduled_end_time ? new Date(data.scheduled_end_time) : null,
      is_emergency: data.is_emergency ?? false,
      source: data.source || 'Manual',
      from_quote_id: data.from_quote_id || null,
    },
    include: { customer: true, assigned_staff: true },
  });

  if (data.price_book_item_id) {
    await prisma.priceBookItem.update({
      where: { id: data.price_book_item_id },
      data: { usage_count: { increment: 1 } },
    }).catch(() => {});
  }

  return job;
}

async function updateJob(id, data) {
  const updateData = {};
  const scalarFields = ['assigned_staff_id', 'status', 'title', 'job_details',
    'price_book_item_id', 'service_call_fee', 'is_emergency', 'photos_urls'];
  scalarFields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
  if (data.scheduled_start_time) updateData.scheduled_start_time = new Date(data.scheduled_start_time);
  if (data.scheduled_end_time) updateData.scheduled_end_time = new Date(data.scheduled_end_time);
  if (data.actual_start_time) updateData.actual_start_time = new Date(data.actual_start_time);
  if (data.actual_end_time) updateData.actual_end_time = new Date(data.actual_end_time);

  return prisma.job.update({ where: { id }, data: updateData, include: { customer: true, assigned_staff: true } });
}

async function startJob(id) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
  if (job.status !== 'Scheduled') throw Object.assign(new Error('Job must be Scheduled to start'), { statusCode: 400 });
  return prisma.job.update({ where: { id }, data: { status: 'InProgress', actual_start_time: new Date() }, include: { customer: true, assigned_staff: true } });
}

async function completeJob(id) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
  if (job.status !== 'InProgress') throw Object.assign(new Error('Job must be InProgress to complete'), { statusCode: 400 });
  return prisma.job.update({ where: { id }, data: { status: 'Completed', actual_end_time: new Date() }, include: { customer: true, assigned_staff: true } });
}

async function addMaterials(jobId, materials) {
  const results = [];
  for (const m of materials) {
    const material = await prisma.material.findUnique({ where: { id: m.material_id } });
    if (!material) continue;
    const jobMat = await prisma.jobMaterial.create({
      data: { job_id: jobId, material_id: m.material_id, quantity_used: m.quantity_used, unit_cost: m.unit_cost ?? material.unit_cost },
      include: { material: true },
    });
    await prisma.material.update({ where: { id: m.material_id }, data: { quantity_on_hand: { decrement: m.quantity_used } } });
    results.push(jobMat);
  }
  return results;
}

async function addPhotos(jobId, photoUrls) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
  const existing = Array.isArray(job.photos_urls) ? job.photos_urls : [];
  return prisma.job.update({ where: { id: jobId }, data: { photos_urls: [...existing, ...photoUrls] } });
}

async function deleteJob(id) {
  return prisma.job.delete({ where: { id } });
}

module.exports = { getJobs, getJobById, createJob, updateJob, startJob, completeJob, addMaterials, addPhotos, deleteJob };
