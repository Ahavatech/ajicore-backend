/**
 * Bookkeeping Transaction Service
 * Manages imported bank transactions, manual bookkeeping entries, and categorization flows.
 */
const prisma = require('../../lib/prisma');
const { ValidationError, NotFoundError } = require('../../utils/errors');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCategory(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeTags(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag) => tag && typeof tag === 'object' && String(tag.name || '').trim() !== '')
    .map((tag) => ({
      name: String(tag.name).trim(),
      color: tag.color ? String(tag.color).trim() : null,
    }));
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return value === true || value === 'true';
}

function normalizeDate(value, fallback = new Date()) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function mapBankTransaction(transaction) {
  return {
    id: transaction.id,
    business_id: transaction.business_id,
    date: transaction.date,
    vendor: transaction.vendor || transaction.normalized_vendor || transaction.raw_description || 'Bank Transaction',
    amount: toNumber(transaction.amount),
    is_income: Boolean(transaction.is_income),
    category: transaction.category ?? null,
    source: transaction.source || 'bank',
    raw_description: transaction.raw_description || null,
    receipt_url: transaction.receipt_url || null,
    notes: null,
    tags: [],
    record_type: 'bank_transaction',
  };
}

function mapLedgerTransaction(transaction) {
  return {
    id: transaction.id,
    business_id: transaction.business_id,
    date: transaction.transaction_date,
    vendor: transaction.vendor || transaction.raw_description || transaction.description || transaction.source || 'Ledger Entry',
    amount: toNumber(transaction.amount),
    is_income: Boolean(transaction.is_income),
    category: transaction.category ?? null,
    source: transaction.source || 'manual',
    raw_description: transaction.raw_description || transaction.description || null,
    receipt_url: transaction.receipt_url || null,
    notes: transaction.notes || null,
    tags: Array.isArray(transaction.tags) ? transaction.tags : [],
    record_type: 'bookkeeping_transaction',
  };
}

async function findTransactionRecord(id) {
  const bank = await prisma.bankTransaction.findUnique({ where: { id } });
  if (bank) return { kind: 'bank', record: bank };

  const ledger = await prisma.bookkeepingTransaction.findUnique({ where: { id } });
  if (ledger) return { kind: 'ledger', record: ledger };

  return null;
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseDelimitedText(text, delimiter = ',') {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');

  if (lines.length < 2) return [];

  const headers = parseDelimitedLine(lines[0], delimiter).map((header) => header.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function mapImportedRowToTransaction(row, businessId) {
  const vendor = row.vendor || row.merchant || row.payee || row.description || row.raw_description || 'Imported transaction';
  const date = row.date || row.transaction_date || row.posted_at || row.posted_date;
  const amount = row.amount || row.total || row.debit || row.credit || 0;
  const incomeCandidate = row.is_income ?? row.income ?? row.type;
  const lowerIncomeCandidate = String(incomeCandidate || '').trim().toLowerCase();
  const isIncome = lowerIncomeCandidate === 'true'
    || lowerIncomeCandidate === 'income'
    || lowerIncomeCandidate === 'credit';

  return {
    business_id: businessId,
    vendor: String(vendor).trim(),
    amount: toNumber(amount),
    category: null,
    description: row.description || null,
    raw_description: row.raw_description || row.description || String(vendor).trim(),
    source: 'import',
    is_income: isIncome,
    receipt_url: row.receipt_url || null,
    notes: row.notes || null,
    tags: [],
    transaction_date: normalizeDate(date),
    reference_id: null,
  };
}

async function downloadFile(fileUrl) {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new ValidationError(`Unable to download file from file_url (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type') || '',
  };
}

async function getTransactions({ business_id, is_income, category, page = 1, limit = 20 }) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const bankWhere = { business_id };
  const ledgerWhere = { business_id };
  if (is_income !== undefined) {
    const incomeValue = normalizeBoolean(is_income);
    bankWhere.is_income = incomeValue;
    ledgerWhere.is_income = incomeValue;
  }
  if (category !== undefined) {
    const normalizedCategory = normalizeCategory(category);
    bankWhere.category = normalizedCategory;
    ledgerWhere.category = normalizedCategory;
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

  const merged = [...bankData.map(mapBankTransaction), ...ledgerData.map(mapLedgerTransaction)]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, parsedLimit);

  const total = bankTotal + ledgerTotal;

  return {
    data: merged,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit),
  };
}

async function getById(id) {
  const found = await findTransactionRecord(id);
  if (!found) return null;
  return found.kind === 'bank' ? mapBankTransaction(found.record) : mapLedgerTransaction(found.record);
}

async function create(data) {
  return prisma.bookkeepingTransaction.create({
    data: {
      business_id: data.business_id,
      vendor: data.vendor || null,
      amount: toNumber(data.amount),
      category: normalizeCategory(data.category),
      description: data.description || null,
      raw_description: data.raw_description || null,
      source: data.source || 'manual',
      is_income: normalizeBoolean(data.is_income),
      receipt_url: data.receipt_url || null,
      notes: data.notes || null,
      tags: normalizeTags(data.tags) ?? [],
      transaction_date: normalizeDate(data.date || data.transaction_date),
      reference_id: data.reference_id || null,
    },
  });
}

async function bulkCreate(business_id, transactions) {
  const records = (Array.isArray(transactions) ? transactions : []).map((transaction) => ({
    business_id,
    vendor: transaction.vendor || null,
    amount: toNumber(transaction.amount),
    category: normalizeCategory(transaction.category) ?? null,
    description: transaction.description || null,
    raw_description: transaction.raw_description || null,
    source: transaction.source || 'manual',
    is_income: normalizeBoolean(transaction.is_income),
    receipt_url: transaction.receipt_url || null,
    notes: transaction.notes || null,
    tags: normalizeTags(transaction.tags) ?? [],
    transaction_date: normalizeDate(transaction.date || transaction.transaction_date),
    reference_id: transaction.reference_id || null,
  }));

  return prisma.bookkeepingTransaction.createMany({ data: records, skipDuplicates: false });
}

async function categorize(id, category, confidence) {
  const found = await findTransactionRecord(id);
  if (!found) throw new NotFoundError('Transaction');

  if (found.kind === 'bank') {
    return prisma.bankTransaction.update({
      where: { id },
      data: { category: normalizeCategory(category), confidence: confidence !== undefined ? toNumber(confidence) : undefined },
    });
  }

  return prisma.bookkeepingTransaction.update({
    where: { id },
    data: { category: normalizeCategory(category) },
  });
}

async function update(id, data) {
  const found = await findTransactionRecord(id);
  if (!found) throw new NotFoundError('Transaction');

  if (found.kind === 'bank') {
    const updateData = {};
    ['vendor', 'receipt_url', 'source', 'raw_description'].forEach((field) => {
      if (data[field] !== undefined) updateData[field] = data[field];
    });
    if (data.category !== undefined) updateData.category = normalizeCategory(data.category);
    if (data.amount !== undefined) updateData.amount = toNumber(data.amount);
    if (data.date !== undefined) updateData.date = normalizeDate(data.date);
    if (data.is_income !== undefined) updateData.is_income = normalizeBoolean(data.is_income);
    return prisma.bankTransaction.update({ where: { id }, data: updateData });
  }

  const updateData = {};
  const fields = ['vendor', 'receipt_url', 'source', 'notes', 'description', 'raw_description', 'reference_id'];
  fields.forEach((field) => {
    if (data[field] !== undefined) updateData[field] = data[field];
  });
  if (data.category !== undefined) updateData.category = normalizeCategory(data.category);
  if (data.amount !== undefined) updateData.amount = toNumber(data.amount);
  if (data.date !== undefined) updateData.transaction_date = normalizeDate(data.date);
  if (data.transaction_date !== undefined) updateData.transaction_date = normalizeDate(data.transaction_date);
  if (data.tags !== undefined) updateData.tags = normalizeTags(data.tags) ?? [];
  if (data.is_income !== undefined) updateData.is_income = normalizeBoolean(data.is_income);
  return prisma.bookkeepingTransaction.update({ where: { id }, data: updateData });
}

async function remove(id) {
  const found = await findTransactionRecord(id);
  if (!found) throw new NotFoundError('Transaction');
  return found.kind === 'bank'
    ? prisma.bankTransaction.delete({ where: { id } })
    : prisma.bookkeepingTransaction.delete({ where: { id } });
}

async function importTransactionsFromFileUrl({ business_id, file_url }) {
  if (!file_url) {
    throw new ValidationError('file_url is required.');
  }

  const { buffer, contentType } = await downloadFile(file_url);
  const lowerUrl = file_url.toLowerCase();
  const delimiter = lowerUrl.endsWith('.tsv') || contentType.includes('tab-separated') ? '\t' : ',';

  if (!(lowerUrl.endsWith('.csv') || lowerUrl.endsWith('.tsv') || contentType.includes('csv') || contentType.includes('text/plain'))) {
    throw new ValidationError('Only CSV and TSV imports are currently supported.');
  }

  const rows = parseDelimitedText(buffer.toString('utf8'), delimiter);
  if (rows.length === 0) {
    return { count: 0, data: [] };
  }

  const records = rows.map((row) => mapImportedRowToTransaction(row, business_id));
  await prisma.bookkeepingTransaction.createMany({ data: records, skipDuplicates: false });

  return { count: records.length, data: records };
}

async function createReceiptTransactionFromUrl({ business_id, file_url }) {
  if (!file_url) {
    throw new ValidationError('file_url is required.');
  }

  const pathname = new URL(file_url).pathname;
  const filename = decodeURIComponent(pathname.split('/').pop() || 'receipt');
  const stem = filename.replace(/\.[^.]+$/, '');
  const amountMatch = stem.match(/(\d+(?:[._]\d{1,2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace('_', '.')) : 0;
  const vendor = stem
    .replace(amountMatch ? amountMatch[0] : '', ' ')
    .replace(/\b(receipt|invoice|img|image|scan)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Unknown Vendor';

  const transaction = await create({
    business_id,
    vendor,
    amount,
    category: null,
    source: 'ocr',
    is_income: false,
    raw_description: vendor,
    receipt_url: file_url,
  });

  return {
    url: file_url,
    extracted_data: { vendor, amount },
    transaction,
  };
}

async function ingestExternalTransactions(businessId, transactions, source) {
  const records = (Array.isArray(transactions) ? transactions : []).map((transaction) => ({
    business_id: businessId,
    vendor: transaction.vendor || transaction.description || source,
    amount: toNumber(transaction.amount),
    category: null,
    description: transaction.description || null,
    raw_description: transaction.raw_description || transaction.description || null,
    source,
    is_income: normalizeBoolean(transaction.is_income),
    receipt_url: transaction.receipt_url || null,
    notes: transaction.notes || null,
    tags: normalizeTags(transaction.tags) ?? [],
    transaction_date: normalizeDate(transaction.date || transaction.transaction_date),
    reference_id: transaction.reference_id || null,
  }));

  if (records.length === 0) {
    return { count: 0 };
  }

  await prisma.bookkeepingTransaction.createMany({ data: records, skipDuplicates: false });
  return { count: records.length };
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

module.exports = {
  getTransactions,
  getById,
  create,
  bulkCreate,
  categorize,
  update,
  remove,
  getSummary,
  importTransactionsFromFileUrl,
  createReceiptTransactionFromUrl,
  ingestExternalTransactions,
};
