const txService = require('./bank_transaction.service');

async function processReceipt(data) {
  return txService.createReceiptTransactionFromUrl(data);
}

module.exports = {
  processReceipt,
};
