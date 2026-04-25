/**
 * Bank Transaction Service
 * Manages imported bank transactions and AI categorization.
 */
const prisma = require('../../lib/prisma');

function mapLedgerTransaction(transaction) {
  return {
    id: transaction.id,
    date: transaction.transaction_date,
    vendor: transaction.description || transaction.source || 'Ledger Entry',
    amount: transaction.amount,
    is_income: transaction.is_income,
    category: transaction.category,
    source: transaction.source,
    receipt_url: null,
  };
}

async function getTransactions({ business_id, is_income, category, page = 1, limit = 20 }) {
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const bankWhere = { business_id };
  const ledgerWhere = { business_id };
  if (is_income !== undefined) {
    const incomeValue = is_income === 'true' || is_income === true;
    bankWhere.is_income = incomeValue;
    ledgerWhere.is_income = incomeValue;
  }
  if (category) {
    bankWhere.category = category;
    ledgerWhere.category = category;
  }

  const skip = (parsedPage - 1) * parsedLimit;
  const [bankData, bankTotal, ledgerData, ledgerTotal] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: bankWhere,
      skip,
      take: parsedLimit * 2,
      orderBy: { date: 'desc' },
    }),
    prisma.bankTransaction.count({ where: bankWhere }),
    prisma.bookkeepingTransaction.findMany({
      where: ledgerWhere,
      skip,
      take: parsedLimit * 2,
      orderBy: { transaction_date: 'desc' },
    }),
    prisma.bookkeepingTransaction.count({ where: ledgerWhere }),
  ]);

  const merged = [...bankData, ...ledgerData.map(mapLedgerTransaction)]
    .sort((a, b) => new Date(b.date || b.transaction_date) - new Date(a.date || a.transaction_date))
    .slice(0, parsedLimit);

  const total = bankTotal + ledgerTotal;

  return { data: merged, total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) };
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
      is_income: data.is_income === true || data.is_income === 'true',
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
    is_income: t.is_income === true || t.is_income === 'true',
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
  const fields = ['vendor', 'category', 'confidence', 'receipt_url', 'normalized_vendor', 'is_income', 'source'];
  fields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
  if (data.amount !== undefined) updateData.amount = parseFloat(data.amount);
  if (data.date !== undefined) updateData.date = new Date(data.date);
  if (updateData.is_income !== undefined) updateData.is_income = updateData.is_income === true || updateData.is_income === 'true';
  return prisma.bankTransaction.update({ where: { id }, data: updateData });
}

async function remove(id) {
  return prisma.bankTransaction.delete({ where: { id } });
}

async function getSummary(business_id) {
  const [income, expenses, ledgerIncome, ledgerExpenses] = await Promise.all([
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
    prisma.bookkeepingTransaction.aggregate({
      where: { business_id, is_income: true },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.bookkeepingTransaction.aggregate({
      where: { business_id, is_income: false },
      _sum: { amount: true },
      _count: true,
    }),
  ]);
  const totalRevenue = (income._sum.amount || 0) + (ledgerIncome._sum.amount || 0);
  const ledgerExpenseAbs = Math.abs(ledgerExpenses._sum.amount || 0);
  const totalExpenses = (expenses._sum.amount || 0) + ledgerExpenseAbs;
  const netProfit = totalRevenue - totalExpenses;
  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    total_income: totalRevenue,
    income_count: income._count,
    total_expenses: totalExpenses,
    expense_count: expenses._count,
    net: netProfit,
  };
}

module.exports = { getTransactions, getById, create, bulkCreate, categorize, update, remove, getSummary };
