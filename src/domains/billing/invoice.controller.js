/**
 * Invoice Controller
 * HTTP handlers for invoices, payments, and expenses.
 */
const invoiceService = require('./invoice.service');
const { generateInvoicePdf } = require('./invoice_pdf.service');
const paymentService = require('./payment.service');
const expenseService = require('./expense.service');

async function getAll(req, res, next) {
  try {
    const { business_id, job_id, status, page = 1, limit = 20 } = req.query;
    const result = await invoiceService.getInvoices({ business_id, job_id, status, page: +page, limit: +limit });
    res.json(result);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const invoice = await invoiceService.getById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) { next(err); }
}

async function getInvoicesByJob(req, res, next) {
  try {
    const invoices = await invoiceService.getByJobId(req.params.jobId);
    res.json(invoices);
  } catch (err) { next(err); }
}

async function createInvoice(req, res, next) {
  try {
    const invoice = await invoiceService.create(req.body);
    res.status(201).json(invoice);
  } catch (err) { next(err); }
}

async function updateInvoice(req, res, next) {
  try {
    const invoice = await invoiceService.update(req.params.id, req.body, req.user?.id);
    res.json(invoice);
  } catch (err) { next(err); }
}

async function sendInvoice(req, res, next) {
  try {
    const invoice = await invoiceService.send(req.params.id);
    res.json(invoice);
  } catch (err) { next(err); }
}

async function voidInvoice(req, res, next) {
  try {
    const invoice = await invoiceService.voidInvoice(req.params.id, req.user?.id);
    res.json(invoice);
  } catch (err) { next(err); }
}

async function refundInvoice(req, res, next) {
  try {
    const result = await invoiceService.refundInvoice(req.params.id, { ...req.body, userId: req.user?.id });
    res.json(result);
  } catch (err) { next(err); }
}

async function getTotal(req, res, next) {
  try {
    const total = await invoiceService.getInvoiceTotal(req.params.id);
    res.json(total);
  } catch (err) { next(err); }
}

async function processPayment(req, res, next) {
  try {
    const result = await paymentService.processPayment(req.params.invoiceId, req.body);
    res.json(result);
  } catch (err) { next(err); }
}

async function downloadInvoicePdf(req, res, next) {
  try {
    const invoice = await invoiceService.getById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const buffer = generateInvoicePdf(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.id}.pdf"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

async function getExpenses(req, res, next) {
  try {
    const { business_id, category, job_id, start_date, end_date, page = 1, limit = 20 } = req.query;
    const expenses = await expenseService.getExpenses({ business_id, category, job_id, start_date, end_date, page: +page, limit: +limit });
    res.json(expenses);
  } catch (err) { next(err); }
}

async function createExpense(req, res, next) {
  try {
    const expense = await expenseService.create(req.body);
    res.status(201).json(expense);
  } catch (err) { next(err); }
}

async function updateExpense(req, res, next) {
  try {
    const expense = await expenseService.update(req.params.id, req.body);
    res.json(expense);
  } catch (err) { next(err); }
}

async function deleteExpense(req, res, next) {
  try {
    await expenseService.remove(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = {
  getAll, getById, getInvoicesByJob, createInvoice, updateInvoice, sendInvoice,
  voidInvoice, refundInvoice, getTotal, processPayment,
  downloadInvoicePdf,
  getExpenses, createExpense, updateExpense, deleteExpense,
};
