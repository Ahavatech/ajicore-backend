/**
 * Quote Service
 * Manages the quote lifecycle: EstimateScheduled → Draft → Sent → Approved/Declined/Expired
 */
const prisma = require('../../lib/prisma');
const logger = require('../../utils/logger');
const { logActivitySafe } = require('../ai_logs/activity_log.service');
const { NotFoundError, ValidationError } = require('../../utils/errors');

function buildCustomerName(customer) {
  if (!customer) return 'Unknown Customer';
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return fullName || 'Unknown Customer';
}

async function getQuotes({
  business_id,
  status,
  customer_id,
  assigned_staff_id,
  start_date,
  end_date,
  search,
  page = 1,
  limit = 20,
}) {
  const where = { business_id };
  if (status) where.status = status;
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
        { scheduled_estimate_date: scheduledRange },
        {
          AND: [
            { scheduled_estimate_date: null },
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
        { description: { contains: search, mode: 'insensitive' } },
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
  const quote = await prisma.quote.create({
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
      line_items: data.line_items ?? null,
      is_emergency: data.is_emergency ?? false,

      source: data.source || 'Manual',
    },
    include: { customer: true, assigned_staff: true },
  });

  await logActivitySafe({
    business_id: quote.business_id,
    customer_id: quote.customer_id,
    event_type: quote.scheduled_estimate_date ? 'schedule.quote_created' : 'quote.created',
    title: quote.scheduled_estimate_date
      ? `Estimate scheduled for ${buildCustomerName(quote.customer)}`
      : `Quote created for ${buildCustomerName(quote.customer)}`,
    details: {
      quote_id: quote.id,
      status: quote.status,
      source: quote.source,
    },
  });

  return quote;
}

async function update(id, data) {
  const updateData = {};
    const scalarFields = ['title', 'description', 'notes', 'decline_reason', 'total_amount', 'assigned_staff_id',
    'price_book_item_id', 'line_items', 'is_emergency'];
  scalarFields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });

  if (data.scheduled_estimate_date) updateData.scheduled_estimate_date = new Date(data.scheduled_estimate_date);
  if (data.status) updateData.status = data.status;

  const quote = await prisma.quote.update({
    where: { id },
    data: updateData,
    include: { customer: true, assigned_staff: true },
  });

  await logActivitySafe({
    business_id: quote.business_id,
    customer_id: quote.customer_id,
    event_type: 'quote.updated',
    title: data.status
      ? `Quote status updated to ${data.status} for ${buildCustomerName(quote.customer)}`
      : `Quote updated for ${buildCustomerName(quote.customer)}`,
    details: {
      quote_id: quote.id,
      status: quote.status,
    },
  });

  return quote;
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

  const updatedQuote = await prisma.quote.update({
    where: { id },
    data: {
      status: 'Sent',
      sent_at: new Date(),
      expires_at,
    },
    include: { customer: true },
  });

  await logActivitySafe({
    business_id: updatedQuote.business_id,
    customer_id: updatedQuote.customer_id,
    event_type: 'quote.sent',
    title: `Quote sent to ${buildCustomerName(updatedQuote.customer)}`,
    details: {
      quote_id: updatedQuote.id,
      expires_at: updatedQuote.expires_at,
    },
  });

  return updatedQuote;
}

/**
 * Approve a quote and convert it to a Job.
 */
async function approveAndConvert(id, jobData = {}) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true, converted_job: true },
  });
  if (!quote) throw new NotFoundError('Quote not found.');
  if (quote.status === 'Expired') throw new ValidationError('Cannot approve an expired quote.');
  if (quote.status === 'Declined') throw new ValidationError('Cannot approve a declined quote.');

  // Idempotency: if already converted, return the existing job reference.
  if (quote.converted_to_job_id) {
    const job = quote.converted_job || await prisma.job.findUnique({ where: { id: quote.converted_to_job_id } });

    return {
      message: 'Approved',
      converted_to_job_id: quote.converted_to_job_id,
      quote: { id: quote.id, status: 'Approved', converted_to_job_id: quote.converted_to_job_id },
      job,
    };
  }

  const scheduled_start_time = jobData.scheduled_start_time ? new Date(jobData.scheduled_start_time) : null;
  const scheduled_end_time = jobData.scheduled_end_time ? new Date(jobData.scheduled_end_time) : null;

  const { job } = await prisma.$transaction(async (tx) => {
    const createdJob = await tx.job.create({
      data: {
        business_id: quote.business_id,
        customer_id: quote.customer_id,
        assigned_staff_id: jobData.assigned_staff_id || quote.assigned_staff_id || null,
        type: 'Job',
        status: 'Scheduled',
        title: jobData.title || quote.title,
        job_details: jobData.job_details || quote.description,
        scheduled_start_time,
        scheduled_end_time,
        source: quote.source,
        is_emergency: quote.is_emergency,
        price_book_item_id: quote.price_book_item_id || null,
        from_quote_id: quote.id,
        line_items: jobData.line_items !== undefined
          ? jobData.line_items
          : (quote.line_items ?? null),
      },
      include: { customer: true },
    });

    await tx.quote.update({
      where: { id },
      data: {
        status: 'Approved',
        approved_at: new Date(),
        converted_to_job_id: createdJob.id,
      },
    });

    return { job: createdJob };
  });

  logger.info(`Quote ${id} approved and converted to Job ${job.id}`);

  await Promise.all([
    logActivitySafe({
      business_id: quote.business_id,
      customer_id: quote.customer_id,
      job_id: job.id,
      event_type: 'quote.approved',
      title: `Quote approved by ${buildCustomerName(quote.customer)}`,
      details: {
        quote_id: quote.id,
        converted_to_job_id: job.id,
      },
    }),
    logActivitySafe({
      business_id: quote.business_id,
      customer_id: quote.customer_id,
      job_id: job.id,
      event_type: scheduled_start_time ? 'schedule.job_created' : 'job.created',
      title: `Job created from quote for ${buildCustomerName(quote.customer)}`,
      details: {
        quote_id: quote.id,
        job_id: job.id,
      },
    }),
  ]);

  return {
    message: 'Approved',
    converted_to_job_id: job.id,
    quote: { id: quote.id, status: 'Approved', converted_to_job_id: job.id },
    job,
  };
}


/**
 * Decline a quote.
 */
async function declineQuote(id, reason) {
  const quote = await prisma.quote.update({
    where: { id },
    data: {
      status: 'Declined',
      declined_at: new Date(),
      decline_reason: reason || null,
      notes: reason ? `Declined: ${reason}` : undefined,
    },
    include: {
      customer: true,
    },
  });

  await logActivitySafe({
    business_id: quote.business_id,
    customer_id: quote.customer_id,
    event_type: 'quote.declined',
    title: `Quote declined for ${buildCustomerName(quote.customer)}`,
    details: {
      quote_id: quote.id,
      reason: reason || null,
    },
  });

  return quote;
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
