/**
 * Invoice Controller
 * Handles HTTP logic for quotes, invoices, expenses, and payments.
 */
const invoiceService = require('./invoice.service');
const paymentService = require('./payment.service');
const expenseService = require('./expense.service');

// --- Quotes & Invoices ---
async function getInvoicesByJob(req, res, next) {
  try {
    const invoices = await invoiceService.getByJobId(req.params.jobId);
    res.json(invoices);
  } catch (err) {
    next(err);
  }
}

async function createInvoice(req, res, next) {
  try {
    const invoice = await invoiceService.create(req.body);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
}

async function updateInvoice(req, res, next) {
  try {
    const invoice = await invoiceService.update(req.params.id, req.body);
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

// --- Payments ---
async function processPayment(req, res, next) {
  try {
    const result = await paymentService.processPayment(req.params.invoiceId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// --- Expenses ---
async function getExpenses(req, res, next) {
  try {
    const { business_id, category, start_date, end_date } = req.query;
    const expenses = await expenseService.getExpenses({ business_id, category, start_date, end_date });
    res.json(expenses);
  } catch (err) {
    next(err);
  }
}

async function createExpense(req, res, next) {
  try {
    const expense = await expenseService.create(req.body);
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInvoicesByJob,
  createInvoice,
  updateInvoice,
  processPayment,
  getExpenses,
  createExpense,
};