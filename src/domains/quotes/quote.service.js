/**
 * Quote Service
 * Manages the quote lifecycle: EstimateScheduled → Draft → Sent → Approved/Declined/Expired
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');
const { NotFoundError, ValidationError } = require('../../utils/errors');

async function getQuotes({ business_id, status, customer_id, page = 1, limit = 20 }) {
  const where = { business_id };
  if (status) where.status = status;
  if (customer_id) where.customer_id = customer_id;

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: true,
        assigned_staff: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quote.count({ where }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getById(id) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      assigned_staff: true,
      converted_job: true,
    },
  });
}

async function create(data) {
  const business = await prisma.business.findUnique({ where: { id: data.business_id } });
  const expiryDays = business?.quote_expiry_days || 30;

  return prisma.quote.create({
    data: {
      business_id: data.business_id,
      customer_id: data.customer_id,
      assigned_staff_id: data.assigned_staff_id || null,
      status: data.status || 'EstimateScheduled',
      title: data.title || null,
      description: data.description || null,
      price_book_item_id: data.price_book_item_id || null,
      scheduled_estimate_date: data.scheduled_estimate_date ? new Date(data.scheduled_estimate_date) : null,
      total_amount: data.total_amount ?? null,
      notes: data.notes || null,
      is_emergency: data.is_emergency ?? false,
      source: data.source || 'Manual',
    },
    include: { customer: true, assigned_staff: true },
  });
}

async function update(id, data) {
  const updateData = {};
  const scalarFields = ['title', 'description', 'notes', 'total_amount', 'assigned_staff_id',
    'price_book_item_id', 'is_emergency'];
  scalarFields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });

  if (data.scheduled_estimate_date) updateData.scheduled_estimate_date = new Date(data.scheduled_estimate_date);
  if (data.status) updateData.status = data.status;

  return prisma.quote.update({
    where: { id },
    data: updateData,
    include: { customer: true, assigned_staff: true },
  });
}

/**
 * Mark quote as sent - sets sent_at and calculates expiry date.
 */
async function sendQuote(id) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { business: true },
  });
  if (!quote) throw new NotFoundError('Quote not found.');

  const expiryDays = quote.business?.quote_expiry_days || 30;
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + expiryDays);

  return prisma.quote.update({
    where: { id },
    data: {
      status: 'Sent',
      sent_at: new Date(),
      expires_at,
    },
    include: { customer: true },
  });
}

/**
 * Approve a quote and convert it to a Job.
 */
async function approveAndConvert(id, jobData = {}) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!quote) throw new NotFoundError('Quote not found.');
  if (quote.status === 'Expired') throw new ValidationError('Cannot approve an expired quote.');

  const job = await prisma.job.create({
    data: {
      business_id: quote.business_id,
      customer_id: quote.customer_id,
      assigned_staff_id: jobData.assigned_staff_id || quote.assigned_staff_id || null,
      type: 'Job',
      status: 'Scheduled',
      title: jobData.title || quote.title,
      job_details: jobData.job_details || quote.description,
      scheduled_start_time: jobData.scheduled_start_time ? new Date(jobData.scheduled_start_time) : null,
      scheduled_end_time: jobData.scheduled_end_time ? new Date(jobData.scheduled_end_time) : null,
      source: quote.source,
    },
    include: { customer: true },
  });

  await prisma.quote.update({
    where: { id },
    data: {
      status: 'Approved',
      approved_at: new Date(),
      converted_to_job_id: job.id,
    },
  });

  logger.info(`Quote ${id} approved and converted to Job ${job.id}`);
  return { quote: { id, status: 'Approved', converted_to_job_id: job.id }, job };
}

/**
 * Decline a quote.
 */
async function declineQuote(id, reason) {
  return prisma.quote.update({
    where: { id },
    data: {
      status: 'Declined',
      declined_at: new Date(),
      notes: reason ? `Declined: ${reason}` : undefined,
    },
  });
}

/**
 * Auto-expire quotes past their expiry date. Called by cron job.
 */
async function expireOldQuotes() {
  const result = await prisma.quote.updateMany({
    where: {
      status: 'Sent',
      expires_at: { lte: new Date() },
    },
    data: { status: 'Expired' },
  });
  logger.info(`Expired ${result.count} old quotes`);
  return result;
}

async function deleteQuote(id) {
  return prisma.quote.delete({ where: { id } });
}

module.exports = { getQuotes, getById, create, update, sendQuote, approveAndConvert, declineQuote, expireOldQuotes, deleteQuote };
