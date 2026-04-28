/**
 * Customer Service
 * Business logic for customer management and lookup.
 */
const { ValidationError } = require('../../utils/errors');
const prisma = require('../../lib/prisma');
const { roundMoney } = require('../../utils/financial_calculator');

const CUSTOMER_TYPES = ['Individual', 'Company'];
const UNPAID_INVOICE_STATUSES = ['Draft', 'Sent', 'Pending', 'Overdue', 'PartiallyPaid'];

function withComputedName(customer) {
  if (!customer) return customer;
  if (Array.isArray(customer)) return customer.map(withComputedName);
  return {
    ...customer,
    name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
  };
}

function sanitizeSearchInput(input, maxLength = 100) {
  if (!input) return null;

  // Trim and limit length
  let sanitized = String(input).trim().substring(0, maxLength);

  // Remove special regex characters that could cause DOS
  sanitized = sanitized.replace(/[.*+?^${}()|[\]\\]/g, '');

  // Reject if contains suspicious patterns
  if (sanitized.match(/[\x00-\x1f\x7f]/)) {
    throw new ValidationError('Invalid search input');
  }

  return sanitized;
}

function validatePagination(page, limit) {
  const MAX_LIMIT = 100;
  const DEFAULT_LIMIT = 20;

  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || DEFAULT_LIMIT));

  return { page, limit };
}

function buildCustomerName(customer) {
  if (!customer) return 'Unknown Customer';
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return fullName || customer.company_name || 'Unknown Customer';
}

function getCustomerAddress(customer) {
  return customer?.location_main || customer?.address || null;
}

function invoiceSubtotal(invoice) {
  if (invoice.total_amount !== undefined && invoice.total_amount !== null) {
    return Number(invoice.total_amount) || 0;
  }
  return (invoice.line_items || []).reduce((sum, line) => {
    const amount = Number(line.total ?? ((line.quantity || 1) * (line.unit_price || 0))) || 0;
    return sum + (line.is_credit ? -amount : amount);
  }, 0);
}

function invoicePaidAmount(invoice) {
  return (invoice.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

function mapCustomerListRow(customer) {
  const allInvoices = [
    ...(customer.invoices || []),
    ...(customer.jobs || []).flatMap((job) => job.invoices || []),
  ];
  const totalSpent = allInvoices.reduce((sum, invoice) => {
    if (invoice.status !== 'Paid') return sum;
    return sum + invoicePaidAmount(invoice);
  }, 0);
  const lastJobDate = (customer.jobs || [])
    .map((job) => job.scheduled_start_time || job.actual_start_time || job.createdAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;

  return withComputedName({
    ...customer,
    location_main: customer.location_main || customer.address || null,
    total_spent: roundMoney(totalSpent),
    total_jobs: customer._count?.jobs ?? (customer.jobs || []).length,
    last_job_date: lastJobDate,
  });
}

function validateCustomerPayload(data, { partial = false } = {}) {
  if (!partial || data.customer_type !== undefined) {
    const type = data.customer_type || 'Individual';
    if (!CUSTOMER_TYPES.includes(type)) {
      throw new ValidationError('customer_type must be Individual or Company.');
    }
  }
}

async function getCustomers({ business_id, search, page = 1, limit = 20 }) {
  const { page: validPage, limit: validLimit } = validatePagination(page, limit);
  const where = { business_id };
  if (search) {
    const cleanSearch = sanitizeSearchInput(search);
    where.OR = [
      { first_name: { contains: cleanSearch, mode: 'insensitive' } },
      { last_name: { contains: cleanSearch, mode: 'insensitive' } },
      { company_name: { contains: cleanSearch, mode: 'insensitive' } },
      { email: { contains: cleanSearch, mode: 'insensitive' } },
      { phone_number: { contains: cleanSearch } },
    ];
  }

  const skip = (validPage - 1) * validLimit;
  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: validLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        jobs: {
          select: {
            id: true,
            createdAt: true,
            scheduled_start_time: true,
            actual_start_time: true,
            invoices: { include: { line_items: true, payments: true } },
          },
        },
        invoices: { include: { line_items: true, payments: true } },
        _count: { select: { jobs: true, quotes: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return { data: data.map(mapCustomerListRow), total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getById(id) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      jobs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { invoices: true },
      },
      quotes: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  return withComputedName(customer);
}

async function findByPhone(businessId, phoneNumber) {
  const customer = await prisma.customer.findFirst({
    where: {
      business_id: businessId,
      phone_number: phoneNumber,
    },
    include: {
      jobs: {
        where: { status: { in: ['Scheduled', 'InProgress'] } },
        orderBy: { scheduled_start_time: 'asc' },
        take: 3,
      },
    },
  });
  return withComputedName(customer);
}

async function create(data) {
  validateCustomerPayload(data);
  const customer = await prisma.customer.create({
    data: {
      business_id: data.business_id,
      first_name: data.first_name,
      last_name: data.last_name,
      customer_type: data.customer_type || 'Individual',
      company_name: data.company_name || null,
      poc_name: data.poc_name || null,
      phone_number: data.phone_number || null,
      email: data.email || null,
      address: data.location_main || data.address || null,
      zip_code: data.zip_code || null,
      location_main: data.location_main || data.address || null,
      location_other: data.location_other || null,
      warranty_enabled: data.warranty_enabled ?? false,
      warranty_due: data.warranty_due ? new Date(data.warranty_due) : null,
      profile_image_url: data.profile_image_url || null,
      notes: data.notes || null,
    },
  });
  return withComputedName(customer);
}

async function update(id, data) {
  validateCustomerPayload(data, { partial: true });
  const updateData = {};
  const fields = [
    'first_name',
    'last_name',
    'customer_type',
    'company_name',
    'poc_name',
    'phone_number',
    'email',
    'address',
    'zip_code',
    'location_main',
    'location_other',
    'warranty_enabled',
    'profile_image_url',
    'notes',
  ];
  fields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
  if (data.location_main !== undefined && data.address === undefined) updateData.address = data.location_main;
  if (data.warranty_due !== undefined) updateData.warranty_due = data.warranty_due ? new Date(data.warranty_due) : null;
  const customer = await prisma.customer.update({ where: { id }, data: updateData });
  return withComputedName(customer);
}

async function remove(id) {
  return prisma.customer.delete({ where: { id } });
}

async function getCustomerJobHistory(customerId, businessId) {
  const where = { customer_id: customerId };
  if (businessId) where.business_id = businessId;

  const [jobs, quotes, invoices] = await Promise.all([
    prisma.job.findMany({
      where,
      include: { invoices: { include: { line_items: true, payments: true } }, assigned_staff: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: {
        business_id: businessId,
        OR: [
          { customer_id: customerId },
          { job: { customer_id: customerId } },
        ],
      },
      include: { line_items: true, payments: true, job: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { jobs, quotes, invoices };
}

async function getCustomerBilling(customerId, businessId) {
  const invoices = await prisma.invoice.findMany({
    where: {
      business_id: businessId,
      status: { in: UNPAID_INVOICE_STATUSES },
      OR: [
        { customer_id: customerId },
        { job: { customer_id: customerId } },
      ],
    },
    include: { line_items: true, payments: true },
  });

  const totalBalance = invoices.reduce((sum, invoice) => {
    return sum + Math.max(0, invoiceSubtotal(invoice) - invoicePaidAmount(invoice));
  }, 0);

  return { total_balance: roundMoney(totalBalance) };
}

async function getCustomerSchedule(customerId, businessId) {
  const now = new Date();
  const [jobs, appointments] = await Promise.all([
    prisma.job.findMany({
      where: {
        business_id: businessId,
        customer_id: customerId,
        scheduled_start_time: { gte: now },
      },
      include: { assigned_staff: true },
      orderBy: { scheduled_start_time: 'asc' },
    }),
    prisma.quote.findMany({
      where: {
        business_id: businessId,
        customer_id: customerId,
        status: 'Appointment',
        scheduled_start_time: { gte: now },
      },
      include: { assigned_staff: true },
      orderBy: { scheduled_start_time: 'asc' },
    }),
  ]);

  const data = [
    ...appointments.map((quote) => ({
      id: quote.id,
      title: quote.service_name || quote.title || 'Estimate Appointment',
      type: 'Appointment',
      technician_name: quote.assigned_staff?.name || null,
      scheduled_start_time: quote.scheduled_start_time,
    })),
    ...jobs.map((job) => ({
      id: job.id,
      title: job.title || job.service_type || 'Job',
      type: 'Job',
      technician_name: job.assigned_staff?.name || null,
      scheduled_start_time: job.scheduled_start_time,
    })),
  ].sort((a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time));

  return { data };
}

async function getMetrics(businessId) {
  const [totalCustomers, totalJobs, paymentAgg, jobsByCustomer] = await Promise.all([
    prisma.customer.count({ where: { business_id: businessId } }),
    prisma.job.count({ where: { business_id: businessId } }),
    prisma.payment.aggregate({
      where: {
        invoice: {
          job: { business_id: businessId },
        },
      },
      _sum: { amount: true },
    }),
    prisma.job.groupBy({
      by: ['customer_id'],
      where: { business_id: businessId },
      _count: { _all: true },
    }),
  ]);

  const totalRevenue = paymentAgg._sum.amount || 0;
  const avgCustomerLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  const repeatCount = jobsByCustomer.filter((row) => (row._count?._all || 0) > 1).length;
  const repeatPercentage = totalCustomers > 0 ? (repeatCount / totalCustomers) * 100 : 0;

  return {
    total_customers: totalCustomers,
    total_jobs_across_all: totalJobs,
    avg_customer_lifetime_value: Math.round(avgCustomerLifetimeValue * 100) / 100,
    repeat_customer_percentage: Math.round(repeatPercentage * 100) / 100,
  };
}

module.exports = {
  getCustomers,
  getById,
  findByPhone,
  create,
  update,
  remove,
  getCustomerJobHistory,
  getCustomerBilling,
  getCustomerSchedule,
  getMetrics,
  buildCustomerName,
  getCustomerAddress,
};
