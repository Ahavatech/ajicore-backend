/**
 * Quote Service
 * Manages quote, estimate appointment, and quote-to-job conversion flows.
 */
const prisma = require('../../lib/prisma');
const logger = require('../../utils/logger');
const { logActivitySafe } = require('../ai_logs/activity_log.service');
const { calculateFinancials } = require('../../utils/financial_calculator');
const { NotFoundError, ValidationError } = require('../../utils/errors');

const PAYMENT_DUE_TERMS = ['Upon receipt', 'Net 15', 'Net 30', 'Net 45'];

function buildCustomerName(customer) {
  if (!customer) return 'Unknown Customer';
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return fullName || customer.company_name || 'Unknown Customer';
}

function customerAddress(customer) {
  return customer?.location_main || customer?.address || null;
}

function daysOpen(createdAt) {
  if (!createdAt) return 0;
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

function normalizeStatus(status, fallback = 'EstimateScheduled') {
  if (!status) return fallback;
  if (status === 'Pending' || status === 'Appointment') return status;
  if (status === 'Sent') return 'Sent';
  return status;
}

function validateDueTerms(value) {
  if (value !== undefined && value !== null && !PAYMENT_DUE_TERMS.includes(value)) {
    throw new ValidationError(`payment_due_terms must be one of: ${PAYMENT_DUE_TERMS.join(', ')}.`);
  }
}

function parseTimeToken(token, fallbackPeriod) {
  const match = String(token || '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const period = match[3] || fallbackPeriod;
  if (minute < 0 || minute > 59 || hour < 1 || hour > 12 || !period) return null;

  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  return { hour, minute };
}

function parseEstimateWindow(dateValue, timeRange) {
  if (!dateValue || !timeRange) return { start: null, end: null };

  const baseDate = new Date(dateValue);
  if (Number.isNaN(baseDate.getTime())) {
    throw new ValidationError('scheduled_estimate_date must be a valid date.');
  }

  const [startRaw, endRaw] = String(timeRange).split('-').map((part) => part.trim());
  const endPeriod = (endRaw || '').toLowerCase().match(/\b(am|pm)\b/)?.[1];
  const startPeriod = (startRaw || '').toLowerCase().match(/\b(am|pm)\b/)?.[1] || endPeriod;
  const startTime = parseTimeToken(startRaw, startPeriod);
  const endTime = parseTimeToken(endRaw, endPeriod || startPeriod);

  if (!startTime || !endTime) {
    throw new ValidationError('scheduled_estimate_time must be a range like "10:00 - 11:00 am".');
  }

  const start = new Date(baseDate);
  start.setHours(startTime.hour, startTime.minute, 0, 0);
  const end = new Date(baseDate);
  end.setHours(endTime.hour, endTime.minute, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);

  return { start, end };
}

async function assertOwnedRecords({ business_id, customer_id, assigned_staff_id }) {
  if (customer_id) {
    const customer = await prisma.customer.findFirst({ where: { id: customer_id, business_id }, select: { id: true } });
    if (!customer) throw new ValidationError('Customer does not belong to this business.');
  }

  if (assigned_staff_id) {
    const staff = await prisma.staff.findFirst({ where: { id: assigned_staff_id, business_id }, select: { id: true } });
    if (!staff) throw new ValidationError('Assigned staff does not belong to this business.');
  }
}

async function nextQuoteNumber(businessId) {
  const count = await prisma.quote.count({ where: { business_id: businessId } }).catch(() => 0);
  return `EST-${String(count + 1).padStart(3, '0')}`;
}

function quoteListRow(quote) {
  const base = {
    ...quote,
    quote_number: quote.quote_number || `EST-${quote.id.slice(0, 8)}`,
    customer_name: buildCustomerName(quote.customer),
    customer_phone: quote.customer?.phone_number || null,
    customer_email: quote.customer?.email || null,
    customer_address: customerAddress(quote.customer),
    technician_name: quote.assigned_staff?.name || null,
    title: quote.service_name || quote.title || quote.description || 'Estimate',
    days_open: daysOpen(quote.createdAt),
  };

  if (quote.status === 'Appointment') {
    return {
      ...base,
      scheduled_start_time: quote.scheduled_start_time || quote.scheduled_estimate_date,
      scheduled_end_time: quote.scheduled_end_time || null,
    };
  }

  return base;
}

function quoteDetailPayload(quote) {
  const subtotal = quote.subtotal ?? (Array.isArray(quote.line_items)
    ? quote.line_items.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
    : quote.total_amount || 0);

  return {
    ...quote,
    quote_number: quote.quote_number || `EST-${quote.id.slice(0, 8)}`,
    business_name: quote.business?.name || null,
    business_address: [quote.business?.street, quote.business?.city, quote.business?.postal_code].filter(Boolean).join(', ') || null,
    customer_name: buildCustomerName(quote.customer),
    customer_phone: quote.customer?.phone_number || null,
    customer_email: quote.customer?.email || null,
    customer_address: customerAddress(quote.customer),
    subtotal,
    discount_percent: quote.discount_percent || 0,
    discount_amount: quote.discount_amount || 0,
    tax_percent: quote.tax_percent || 0,
    tax_amount: quote.tax_amount || 0,
    total_amount: quote.total_amount || 0,
    due_amount: quote.due_amount ?? quote.deposit_amount ?? quote.total_amount ?? 0,
    due_date: quote.expires_at || null,
    footer_note: quote.business?.finance_settings?.company_notes || null,
    timeline: {
      created_at: quote.createdAt,
      viewed_at: quote.viewed_at || null,
      follow_up_at: quote.follow_up_at || null,
      approved_at: quote.approved_at || null,
    },
  };
}

function buildQuoteData(data, existing = null) {
  validateDueTerms(data.payment_due_terms);

  const isAppointment = data.is_estimate_appointment ?? existing?.is_estimate_appointment ?? false;
  if (isAppointment && !data.assigned_staff_id && !existing?.assigned_staff_id) {
    throw new ValidationError('assigned_staff_id is required for estimate appointments.');
  }

  let schedule = { start: null, end: null };
  const estimateDate = data.scheduled_estimate_date ?? existing?.scheduled_estimate_date;
  const estimateTime = data.scheduled_estimate_time ?? existing?.scheduled_estimate_time;
  if (isAppointment || data.scheduled_estimate_time !== undefined) {
    schedule = parseEstimateWindow(estimateDate, estimateTime);
  }

  const financials = calculateFinancials(data);
  const updateData = {
    assigned_staff_id: data.assigned_staff_id ?? undefined,
    status: data.status ? normalizeStatus(data.status) : undefined,
    title: data.service_name ?? data.title ?? undefined,
    service_name: data.service_name ?? undefined,
    service_category: data.service_category ?? undefined,
    contract_type: data.contract_type ?? undefined,
    warranty_due: data.warranty_due ? new Date(data.warranty_due) : undefined,
    description: data.description ?? undefined,
    photos: data.photos ?? undefined,
    price_book_item_id: data.price_book_item_id ?? undefined,
    scheduled_estimate_date: data.scheduled_estimate_date ? new Date(data.scheduled_estimate_date) : undefined,
    scheduled_estimate_time: data.scheduled_estimate_time ?? undefined,
    scheduled_start_time: schedule.start || undefined,
    scheduled_end_time: schedule.end || undefined,
    notes: data.notes ?? undefined,
    decline_reason: data.decline_reason ?? undefined,
    line_items: data.line_items !== undefined ? financials.line_items : undefined,
    is_estimate_appointment: data.is_estimate_appointment ?? undefined,
    is_emergency: data.is_emergency ?? undefined,
    source: data.source ?? undefined,
    manual_subtotal: data.manual_subtotal !== undefined ? financials.manual_subtotal : undefined,
    subtotal: data.line_items !== undefined || data.manual_subtotal !== undefined ? financials.subtotal : undefined,
    discount_percent: data.discount_percent !== undefined ? financials.discount_percent : undefined,
    discount_amount: data.discount_percent !== undefined || data.line_items !== undefined || data.manual_subtotal !== undefined ? financials.discount_amount : undefined,
    tax_percent: data.tax_percent !== undefined ? financials.tax_percent : undefined,
    tax_amount: data.tax_percent !== undefined || data.line_items !== undefined || data.manual_subtotal !== undefined ? financials.tax_amount : undefined,
    deposit_percent: data.deposit_percent !== undefined ? financials.deposit_percent : undefined,
    deposit_amount: data.deposit_percent !== undefined || data.line_items !== undefined || data.manual_subtotal !== undefined ? financials.deposit_amount : undefined,
    total_amount: data.line_items !== undefined || data.manual_subtotal !== undefined || data.total_amount !== undefined ? financials.total_amount : undefined,
    due_amount: data.line_items !== undefined || data.manual_subtotal !== undefined || data.deposit_percent !== undefined ? financials.due_amount : undefined,
    payment_due_terms: data.payment_due_terms ?? undefined,
  };

  Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);
  return updateData;
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
      scheduledRange.gte = new Date(start_date);
      fallbackCreatedRange.gte = new Date(start_date);
    }
    if (end_date) {
      scheduledRange.lte = new Date(end_date);
      fallbackCreatedRange.lte = new Date(end_date);
    }
    andClauses.push({
      OR: [
        { scheduled_start_time: scheduledRange },
        { scheduled_estimate_date: scheduledRange },
        { AND: [{ scheduled_start_time: null }, { scheduled_estimate_date: null }, { createdAt: fallbackCreatedRange }] },
      ],
    });
  }

  if (search) {
    andClauses.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { service_name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { first_name: { contains: search, mode: 'insensitive' } },
              { last_name: { contains: search, mode: 'insensitive' } },
              { company_name: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ],
    });
  }

  if (andClauses.length > 0) where.AND = andClauses;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;
  const [data, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      skip,
      take: parsedLimit,
      include: {
        customer: true,
        assigned_staff: true,
      },
      orderBy: status === 'Appointment' ? { scheduled_start_time: 'asc' } : { createdAt: 'desc' },
    }),
    prisma.quote.count({ where }),
  ]);

  return { data: data.map(quoteListRow), total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) };
}

async function getById(id) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      business: { include: { finance_settings: true } },
      customer: true,
      assigned_staff: true,
      converted_job: true,
    },
  });
  return quote ? quoteDetailPayload(quote) : null;
}

async function create(data) {
  await assertOwnedRecords(data);
  const quoteData = buildQuoteData(data);
  const quote = await prisma.quote.create({
    data: {
      business_id: data.business_id,
      customer_id: data.customer_id,
      quote_number: data.quote_number || await nextQuoteNumber(data.business_id),
      status: quoteData.status || (data.is_estimate_appointment ? 'Draft' : 'Draft'),
      ...quoteData,
    },
    include: { customer: true, assigned_staff: true },
  });

  await logActivitySafe({
    business_id: quote.business_id,
    customer_id: quote.customer_id,
    event_type: quote.scheduled_start_time ? 'schedule.quote_created' : 'quote.created',
    title: quote.scheduled_start_time
      ? `Estimate scheduled for ${buildCustomerName(quote.customer)}`
      : `Quote created for ${buildCustomerName(quote.customer)}`,
    details: { quote_id: quote.id, status: quote.status, source: quote.source },
  });

  return quoteListRow(quote);
}

async function update(id, data) {
  const existing = await prisma.quote.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Quote');
  await assertOwnedRecords({
    business_id: existing.business_id,
    customer_id: data.customer_id,
    assigned_staff_id: data.assigned_staff_id,
  });

  const quote = await prisma.quote.update({
    where: { id },
    data: buildQuoteData(data, existing),
    include: { customer: true, assigned_staff: true },
  });

  await logActivitySafe({
    business_id: quote.business_id,
    customer_id: quote.customer_id,
    event_type: 'quote.updated',
    title: data.status
      ? `Quote status updated to ${quote.status} for ${buildCustomerName(quote.customer)}`
      : `Quote updated for ${buildCustomerName(quote.customer)}`,
    details: { quote_id: quote.id, status: quote.status },
  });

  return quoteListRow(quote);
}

async function sendQuote(id) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { business: true, customer: true, assigned_staff: true },
  });
  if (!quote) throw new NotFoundError('Quote');

  const expiryDays = quote.business?.quote_expiry_days || 30;
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + expiryDays);
  const nextStatus = quote.is_estimate_appointment ? 'Appointment' : 'Pending';

  if (quote.is_estimate_appointment && !quote.assigned_staff_id) {
    throw new ValidationError('assigned_staff_id is required for estimate appointments.');
  }

  const updatedQuote = await prisma.quote.update({
    where: { id },
    data: {
      status: nextStatus,
      sent_at: new Date(),
      expires_at,
    },
    include: { customer: true, assigned_staff: true },
  });

  await logActivitySafe({
    business_id: updatedQuote.business_id,
    customer_id: updatedQuote.customer_id,
    event_type: quote.is_estimate_appointment ? 'quote.appointment_sent' : 'quote.sent',
    title: quote.is_estimate_appointment
      ? `Estimate appointment sent to ${updatedQuote.assigned_staff?.name || 'assigned technician'}`
      : `Quote sent to ${buildCustomerName(updatedQuote.customer)}`,
    details: { quote_id: updatedQuote.id, status: updatedQuote.status, expires_at: updatedQuote.expires_at },
  });

  return quoteListRow(updatedQuote);
}

async function approveQuote(id) {
  const quote = await prisma.quote.update({
    where: { id },
    data: {
      status: 'Approved',
      approved_at: new Date(),
    },
    include: { customer: true, assigned_staff: true },
  });

  await logActivitySafe({
    business_id: quote.business_id,
    customer_id: quote.customer_id,
    event_type: 'quote.approved',
    title: `Quote approved by ${buildCustomerName(quote.customer)}`,
    details: { quote_id: quote.id },
  });

  return quoteListRow(quote);
}

async function convertToJob(id, jobData = {}) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true, converted_job: true },
  });
  if (!quote) throw new NotFoundError('Quote');
  if (quote.converted_to_job_id) {
    return { message: 'Converted successfully', job_id: quote.converted_to_job_id };
  }

  const { job } = await prisma.$transaction(async (tx) => {
    const createdJob = await tx.job.create({
      data: {
        business_id: quote.business_id,
        customer_id: quote.customer_id,
        assigned_staff_id: jobData.assigned_staff_id || quote.assigned_staff_id || null,
        type: 'Job',
        status: 'Scheduled',
        title: jobData.title || quote.service_name || quote.title,
        job_details: jobData.job_details || quote.description,
        scheduled_start_time: jobData.scheduled_start_time ? new Date(jobData.scheduled_start_time) : (quote.scheduled_start_time || null),
        scheduled_end_time: jobData.scheduled_end_time ? new Date(jobData.scheduled_end_time) : (quote.scheduled_end_time || null),
        address: customerAddress(quote.customer),
        source: quote.source,
        is_emergency: quote.is_emergency,
        price_book_item_id: quote.price_book_item_id || null,
        from_quote_id: quote.id,
        line_items: jobData.line_items !== undefined ? jobData.line_items : (quote.line_items ?? null),
      },
    });

    await tx.quote.update({
      where: { id },
      data: {
        status: 'Approved',
        approved_at: quote.approved_at || new Date(),
        converted_to_job_id: createdJob.id,
      },
    });

    return { job: createdJob };
  });

  logger.info(`Quote ${id} converted to Job ${job.id}`);
  await logActivitySafe({
    business_id: quote.business_id,
    customer_id: quote.customer_id,
    job_id: job.id,
    event_type: 'quote.converted',
    title: `Job created from quote for ${buildCustomerName(quote.customer)}`,
    details: { quote_id: quote.id, job_id: job.id },
  });

  return { message: 'Converted successfully', job_id: job.id };
}

async function declineQuote(id, reason) {
  const quote = await prisma.quote.update({
    where: { id },
    data: {
      status: 'Declined',
      declined_at: new Date(),
      decline_reason: reason || null,
    },
    include: { customer: true, assigned_staff: true },
  });

  await logActivitySafe({
    business_id: quote.business_id,
    customer_id: quote.customer_id,
    event_type: 'quote.declined',
    title: `Quote declined for ${buildCustomerName(quote.customer)}`,
    details: { quote_id: quote.id, reason: reason || null },
  });

  return quoteListRow(quote);
}

async function expireOldQuotes() {
  const result = await prisma.quote.updateMany({
    where: {
      status: { in: ['Sent', 'Pending'] },
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

module.exports = {
  getQuotes,
  getById,
  create,
  update,
  sendQuote,
  approveQuote,
  convertToJob,
  declineQuote,
  expireOldQuotes,
  deleteQuote,
  parseEstimateWindow,
};
