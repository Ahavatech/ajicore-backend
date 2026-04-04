/**
 * Job Service
 * Business logic for job CRUD, status transitions, and time tracking.
 * Jobs: Scheduled → InProgress → Completed → Invoiced
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');
const { logActivitySafe } = require('../ai_logs/activity_log.service');
const { NotFoundError, ValidationError } = require('../../utils/errors');

function buildCustomerName(customer) {
  if (!customer) return 'Unknown Customer';
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return fullName || 'Unknown Customer';
}

function buildJobLabel(job) {
  return job.service_type || job.title || job.type || 'Service Job';
}

async function getJobs({
  business_id,
  status,
  type,
  customer_id,
  assigned_staff_id,
  start_date,
  end_date,
  search,
  page = 1,
  limit = 20,
}) {
  const where = {};
  if (business_id) where.business_id = business_id;
  if (status) where.status = status;
  if (type) where.type = type;
  if (customer_id) where.customer_id = customer_id;
  if (assigned_staff_id) where.assigned_staff_id = assigned_staff_id;

  const andClauses = [];

  if (start_date || end_date) {
    const scheduledRange = {};
    const fallbackCreatedRange = {};

    if (start_date) {
      const start = new Date(start_date);
      scheduledRange.gte = start;
      fallbackCreatedRange.gte = start;
    }

    if (end_date) {
      const end = new Date(end_date);
      scheduledRange.lte = end;
      fallbackCreatedRange.lte = end;
    }

    andClauses.push({
      OR: [
        { scheduled_start_time: scheduledRange },
        {
          AND: [
            { scheduled_start_time: null },
            { createdAt: fallbackCreatedRange },
          ],
        },
      ],
    });
  }

  if (search) {
    andClauses.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { service_type: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { first_name: { contains: search, mode: 'insensitive' } },
              { last_name: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ],
    });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

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
      address: data.address || null,
      service_type: data.service_type || null,
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

  if (job.assigned_staff_id && job.status === 'InProgress') {
    await prisma.staff.update({
      where: { id: job.assigned_staff_id },
      data: { active_job_id: job.id },
    }).catch(() => {});
  }

  await logActivitySafe({
    business_id: job.business_id,
    customer_id: job.customer_id,
    job_id: job.id,
    event_type: job.scheduled_start_time ? 'schedule.job_created' : 'job.created',
    title: `${buildJobLabel(job)} created for ${buildCustomerName(job.customer)}`,
    details: {
      job_id: job.id,
      status: job.status,
      source: job.source,
    },
  });

  return job;
}

async function updateJob(id, data) {
  const updateData = {};
  const scalarFields = ['assigned_staff_id', 'status', 'title', 'job_details',
    'price_book_item_id', 'service_call_fee', 'is_emergency', 'photos_urls', 'address', 'service_type', 'type'];
  scalarFields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
  if (data.scheduled_start_time) updateData.scheduled_start_time = new Date(data.scheduled_start_time);
  if (data.scheduled_end_time) updateData.scheduled_end_time = new Date(data.scheduled_end_time);
  if (data.actual_start_time) updateData.actual_start_time = new Date(data.actual_start_time);
  if (data.actual_end_time) updateData.actual_end_time = new Date(data.actual_end_time);

  const job = await prisma.job.update({ where: { id }, data: updateData, include: { customer: true, assigned_staff: true } });

  if (job.assigned_staff_id) {
    if (job.status === 'InProgress') {
      await prisma.staff.update({
        where: { id: job.assigned_staff_id },
        data: { active_job_id: job.id },
      }).catch(() => {});
    } else if (['Completed', 'Cancelled', 'Invoiced'].includes(job.status)) {
      await prisma.staff.updateMany({
        where: { id: job.assigned_staff_id, active_job_id: job.id },
        data: { active_job_id: null },
      }).catch(() => {});
    }
  }

  await logActivitySafe({
    business_id: job.business_id,
    customer_id: job.customer_id,
    job_id: job.id,
    event_type: 'job.updated',
    title: `${buildJobLabel(job)} updated for ${buildCustomerName(job.customer)}`,
    details: {
      job_id: job.id,
      status: job.status,
    },
  });

  return job;
}

async function startJob(id) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) throw new NotFoundError('Job not found.');
  if (job.status !== 'Scheduled') throw new ValidationError('Job must be Scheduled to start.');

  const startedJob = await prisma.$transaction(async (tx) => {
    const updatedJob = await tx.job.update({
      where: { id },
      data: { status: 'InProgress', actual_start_time: new Date() },
      include: { customer: true, assigned_staff: true },
    });

    if (updatedJob.assigned_staff_id) {
      await tx.staff.update({
        where: { id: updatedJob.assigned_staff_id },
        data: { active_job_id: updatedJob.id },
      }).catch(() => {});
    }

    return updatedJob;
  });

  await logActivitySafe({
    business_id: startedJob.business_id,
    customer_id: startedJob.customer_id,
    job_id: startedJob.id,
    event_type: 'job.started',
    title: `${buildJobLabel(startedJob)} started for ${buildCustomerName(startedJob.customer)}`,
    details: {
      job_id: startedJob.id,
      status: startedJob.status,
    },
  });

  return startedJob;
}

async function completeJob(id) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) throw new NotFoundError('Job not found.');
  if (job.status !== 'InProgress') throw new ValidationError('Job must be InProgress to complete.');

  const completedJob = await prisma.$transaction(async (tx) => {
    const updatedJob = await tx.job.update({
      where: { id },
      data: { status: 'Completed', actual_end_time: new Date() },
      include: { customer: true, assigned_staff: true },
    });

    if (updatedJob.assigned_staff_id) {
      await tx.staff.updateMany({
        where: { id: updatedJob.assigned_staff_id, active_job_id: updatedJob.id },
        data: { active_job_id: null },
      });
    }

    return updatedJob;
  });

  await logActivitySafe({
    business_id: completedJob.business_id,
    customer_id: completedJob.customer_id,
    job_id: completedJob.id,
    event_type: 'job.completed',
    title: `${buildJobLabel(completedJob)} completed for ${buildCustomerName(completedJob.customer)}`,
    details: {
      job_id: completedJob.id,
      status: completedJob.status,
    },
  });

  return completedJob;
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
  if (!job) throw new NotFoundError('Job not found.');
  const existing = Array.isArray(job.photos_urls) ? job.photos_urls : [];
  return prisma.job.update({ where: { id: jobId }, data: { photos_urls: [...existing, ...photoUrls] } });
}

async function deleteJob(id) {
  return prisma.job.delete({ where: { id } });
}

module.exports = { getJobs, getJobById, createJob, updateJob, startJob, completeJob, addMaterials, addPhotos, deleteJob };
