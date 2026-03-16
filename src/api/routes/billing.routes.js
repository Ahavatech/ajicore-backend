/**
 * Billing Routes
 * Endpoints for invoices, payments, and expenses.
 * @swagger
 * tags:
 *   name: Billing
 *   description: Invoices, payments, and expenses
 */
const { Router } = require('express');
const billingController = require('../../domains/billing/invoice.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

// --- Invoices ---
router.get('/invoices', billingController.getAll);
router.get('/invoices/job/:jobId', validateUUID('jobId'), billingController.getInvoicesByJob);
router.get('/invoices/:id', validateUUID('id'), billingController.getById);
router.get('/invoices/:id/total', validateUUID('id'), billingController.getTotal);
router.post('/invoices', requireFields(['job_id', 'business_id']), billingController.createInvoice);
router.patch('/invoices/:id', validateUUID('id'), billingController.updateInvoice);
router.post('/invoices/:id/send', validateUUID('id'), billingController.sendInvoice);
router.post('/invoices/:id/void', validateUUID('id'), billingController.voidInvoice);
router.post('/invoices/:id/refund', validateUUID('id'), billingController.refundInvoice);

// --- Payments ---
router.post('/payments/:invoiceId', validateUUID('invoiceId'), requireFields(['amount']), billingController.processPayment);

// --- Expenses ---
router.get('/expenses', billingController.getExpenses);
router.post('/expenses', requireFields(['business_id', 'amount']), billingController.createExpense);
router.patch('/expenses/:id', validateUUID('id'), billingController.updateExpense);
router.delete('/expenses/:id', validateUUID('id'), billingController.deleteExpense);

module.exports = router;
