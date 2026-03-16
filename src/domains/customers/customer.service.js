/**
 * Customer Service
 * Business logic for customer management and lookup.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCustomers({ business_id, search, page = 1, limit = 20 }) {
  const where = { business_id };
  if (search) {
    where.OR = [
      { first_name: { contains: search, mode: 'insensitive' } },
      { last_name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone_number: { contains: search } },
    ];
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { jobs: true, quotes: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getById(id) {
  return prisma.customer.findUnique({
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
}

async function findByPhone(businessId, phoneNumber) {
  return prisma.customer.findFirst({
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
}

async function create(data) {
  return prisma.customer.create({
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
}

async function update(id, data) {
  const updateData = {};
  const fields = ['first_name', 'last_name', 'phone_number', 'email', 'address', 'zip_code', 'notes'];
  fields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
  return prisma.customer.update({ where: { id }, data: updateData });
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
