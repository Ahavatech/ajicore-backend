/**
 * Billing Routes
 * Endpoints for invoices, quotes, payments, and expenses.
 */
const { Router } = require('express');
const billingController = require('../../domains/billing/invoice.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();

router.use(requireAuth);

// --- Invoices & Quotes ---
// GET /api/billing/invoices/job/:jobId - Get all invoices/quotes for a job
router.get('/invoices/job/:jobId', validateUUID('jobId'), billingController.getInvoicesByJob);

// POST /api/billing/invoices - Create a new invoice or quote
router.post(
  '/invoices',
  requireFields(['job_id', 'type', 'total_amount']),
  billingController.createInvoice
);

// PATCH /api/billing/invoices/:id - Update an invoice/quote
router.patch('/invoices/:id', validateUUID('id'), billingController.updateInvoice);

// --- Payments ---
// POST /api/billing/payments/:invoiceId - Process a payment for an invoice
router.post(
  '/payments/:invoiceId',
  validateUUID('invoiceId'),
  requireFields(['amount', 'payment_method_id']),
  billingController.processPayment
);

// --- Expenses ---
// GET /api/billing/expenses - List expenses (filterable)
router.get('/expenses', billingController.getExpenses);

// POST /api/billing/expenses - Create a new expense
router.post(
  '/expenses',
  requireFields(['business_id', 'category', 'amount']),
  billingController.createExpense
);

module.exports = router;