const prisma = require('../../lib/prisma');

async function recordLedgerTransaction({
  business_id,
  source,
  is_income,
  amount,
  category,
  description,
  reference_id,
  transaction_date,
}) {
  return prisma.bookkeepingTransaction.create({
    data: {
      business_id,
      source,
      is_income,
      amount,
      category,
      description: description || null,
      reference_id: reference_id || null,
      transaction_date: transaction_date ? new Date(transaction_date) : new Date(),
    },
  });
}

module.exports = {
  recordLedgerTransaction,
};
