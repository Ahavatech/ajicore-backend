/**
 * Expense Service
 * Business logic for tracking and querying business expenses.
 */
const prisma = require('../../lib/prisma');

async function getExpenses({ business_id, category, job_id, start_date, end_date, page = 1, limit = 50 }) {
  const where = {};
  if (business_id) where.business_id = business_id;
  if (category) where.category = category;
  if (job_id) where.job_id = job_id;
  if (start_date || end_date) {
    where.date = {};
    if (start_date) where.date.gte = new Date(start_date);
    if (end_date) where.date.lte = new Date(end_date);
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    prisma.expense.findMany({ where, skip, take: limit, orderBy: { date: 'desc' }, include: { job: { include: { customer: true } } } }),
    prisma.expense.count({ where }),
  ]);

  const totalAmount = await prisma.expense.aggregate({ where, _sum: { amount: true } });

  return { data, total, page, limit, totalPages: Math.ceil(total / limit), total_amount: totalAmount._sum.amount || 0 };
}

async function create(data) {
  return prisma.expense.create({
    data: {
      business_id: data.business_id,
      job_id: data.job_id || null,
      category: data.category || 'Other',
      amount: data.amount,
      description: data.description || null,
      receipt_url: data.receipt_url || null,
      date: data.date ? new Date(data.date) : new Date(),
    },
    include: { job: true },
  });
}

async function update(id, data) {
  const updateData = {};
  const fields = ['category', 'amount', 'description', 'receipt_url', 'job_id'];
  fields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
  if (data.date) updateData.date = new Date(data.date);
  return prisma.expense.update({ where: { id }, data: updateData });
}

async function remove(id) {
  return prisma.expense.delete({ where: { id } });
}

module.exports = { getExpenses, create, update, remove };
