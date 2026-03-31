/**
 * Bank Transaction Service
 * Manages imported bank transactions and AI categorization.
 */
const prisma = require('../../lib/prisma');

async function getTransactions({ business_id, is_income, category, page = 1, limit = 20 }) {
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const where = { business_id };
  if (is_income !== undefined) where.is_income = is_income === 'true' || is_income === true;
  if (category) where.category = category;

  const skip = (parsedPage - 1) * parsedLimit;
  const [data, total] = await Promise.all([
    prisma.bankTransaction.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: { date: 'desc' },
    }),
    prisma.bankTransaction.count({ where }),
  ]);

  return { data, total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) };
}

async function getById(id) {
  return prisma.bankTransaction.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.bankTransaction.create({
    data: {
      business_id: data.business_id,
      vendor: data.vendor || null,
      amount: parseFloat(data.amount),
      date: new Date(data.date),
      category: data.category || null,
      confidence: data.confidence != null ? parseFloat(data.confidence) : null,
      source: data.source || null,
      is_income: data.is_income || false,
      receipt_url: data.receipt_url || null,
      raw_description: data.raw_description || null,
      normalized_vendor: data.normalized_vendor || null,
    },
  });
}

async function bulkCreate(business_id, transactions) {
  const records = transactions.map((t) => ({
    business_id,
    vendor: t.vendor || null,
    amount: parseFloat(t.amount),
    date: new Date(t.date),
    category: t.category || null,
    confidence: t.confidence != null ? parseFloat(t.confidence) : null,
    source: t.source || null,
    is_income: t.is_income || false,
    receipt_url: t.receipt_url || null,
    raw_description: t.raw_description || null,
    normalized_vendor: t.normalized_vendor || null,
  }));
  return prisma.bankTransaction.createMany({ data: records, skipDuplicates: true });
}

async function categorize(id, category, confidence) {
  return prisma.bankTransaction.update({
    where: { id },
    data: { category, confidence: confidence != null ? parseFloat(confidence) : null },
  });
}

async function update(id, data) {
  const updateData = {};
  const fields = ['vendor', 'category', 'confidence', 'receipt_url', 'normalized_vendor', 'is_income'];
  fields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
  return prisma.bankTransaction.update({ where: { id }, data: updateData });
}

async function remove(id) {
  return prisma.bankTransaction.delete({ where: { id } });
}

async function getSummary(business_id) {
  const [income, expenses] = await Promise.all([
    prisma.bankTransaction.aggregate({
      where: { business_id, is_income: true },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.bankTransaction.aggregate({
      where: { business_id, is_income: false },
      _sum: { amount: true },
      _count: true,
    }),
  ]);
  return {
    total_income: income._sum.amount || 0,
    income_count: income._count,
    total_expenses: expenses._sum.amount || 0,
    expense_count: expenses._count,
    net: (income._sum.amount || 0) - (expenses._sum.amount || 0),
  };
}

module.exports = { getTransactions, getById, create, bulkCreate, categorize, update, remove, getSummary };
