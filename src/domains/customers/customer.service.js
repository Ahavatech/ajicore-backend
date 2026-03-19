/**
 * Customer Service
 * Business logic for customer management and lookup.
 */
const { PrismaClient } = require('@prisma/client');
const { ValidationError } = require('../../utils/errors');
const prisma = new PrismaClient();

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

async function getCustomers({ business_id, search, page = 1, limit = 20 }) {
  const { page: validPage, limit: validLimit } = validatePagination(page, limit);
  const where = { business_id };
  if (search) {
    const cleanSearch = sanitizeSearchInput(search);
    where.OR = [
      { first_name: { contains: cleanSearch, mode: 'insensitive' } },
      { last_name: { contains: cleanSearch, mode: 'insensitive' } },
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
        _count: { select: { jobs: true, quotes: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return { data: withComputedName(data), total, page, limit, totalPages: Math.ceil(total / limit) };
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
  const customer = await prisma.customer.create({
    data: {
      business_id: data.business_id,
      first_name: data.first_name,
      last_name: data.last_name,
      phone_number: data.phone_number || null,
      email: data.email || null,
      address: data.address || null,
      zip_code: data.zip_code || null,
      notes: data.notes || null,
    },
  });
  return withComputedName(customer);
}

async function update(id, data) {
  const updateData = {};
  const fields = ['first_name', 'last_name', 'phone_number', 'email', 'address', 'zip_code', 'notes'];
  fields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
  const customer = await prisma.customer.update({ where: { id }, data: updateData });
  return withComputedName(customer);
}

async function remove(id) {
  return prisma.customer.delete({ where: { id } });
}

async function getCustomerJobHistory(customerId) {
  const [jobs, quotes] = await Promise.all([
    prisma.job.findMany({
      where: { customer_id: customerId },
      include: { invoices: { include: { line_items: true, payments: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quote.findMany({
      where: { customer_id: customerId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { jobs, quotes };
}

module.exports = { getCustomers, getById, findByPhone, create, update, remove, getCustomerJobHistory };
