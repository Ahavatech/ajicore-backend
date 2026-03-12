/**
 * Expense Service
 * Business logic for tracking and querying business expenses.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getExpenses({ business_id, category, start_date, end_date }) {
  const where = {};
  if (business_id) where.business_id = business_id;
  if (category) where.category = category;
  if (start_date || end_date) {
    where.date = {};
    if (start_date) where.date.gte = new Date(start_date);
    if (end_date) where.date.lte = new Date(end_date);
  }

  return prisma.expense.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { job: true },
  });
}

async function create(data) {
  return prisma.expense.create({
    data: {
      business_id: data.business_id,
      job_id: data.job_id || null,
      category: data.category,
      amount: data.amount,
      description: data.description || null,
      date: data.date ? new Date(data.date) : new Date(),
    },
  });
}

module.exports = { getExpenses, create };