/**
 * Billing Routes
 * Endpoints for invoices, payments, and expenses.
 */

/**
 * @swagger
 * tags:
 *   name: Billing
 *   description: Invoices, payments, and expenses
 */

const { Router } = require('express');
const billingController = require('../../domains/billing/invoice.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

// --- Invoices ---

/**
 * @swagger
 * /api/billing/invoices:
 *   get:
 *     summary: Get all invoices
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 */
router.get('/invoices', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), billingController.getAll);

/**
 * @swagger
 * /api/billing/invoices/job/{jobId}:
 *   get:
 *     summary: Get invoices for a specific job
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/invoices/job/:jobId', validateUUID('jobId'), requireResourceAccess('job', { field: 'jobId' }), billingController.getInvoicesByJob);

/**
 * @swagger
 * /api/billing/invoices/{id}:
 *   get:
 *     summary: Get invoice by ID
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 */
router.get('/invoices/:id', validateUUID('id'), requireResourceAccess('invoice'), billingController.getById);

/**
 * @swagger
 * /api/billing/invoices/{id}/pdf:
 *   get:
 *     summary: Download invoice PDF
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 */
router.get('/invoices/:id/pdf', validateUUID('id'), requireResourceAccess('invoice'), billingController.downloadInvoicePdf);

/**
 * @swagger
 * /api/billing/invoices/{id}/total:
 *   get:
 *     summary: Get total amount for an invoice
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 */
router.get('/invoices/:id/total', validateUUID('id'), requireResourceAccess('invoice'), billingController.getTotal);

/**
 * @swagger
 * /api/billing/invoices:
 *   post:
 *     summary: Create a new invoice
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id]
 *             properties:
 *               business_id: { type: string, format: uuid }
 *               customer_id: { type: string, format: uuid, nullable: true }
 *               job_id: { type: string, format: uuid, nullable: true }
 *               service_name: { type: string, nullable: true }
 *               service_category: { type: string, nullable: true }
 *               custom_category_name: { type: string, nullable: true }
 *               contract_type:
 *                 type: object
 *                 additionalProperties: true
 *               warranty_due: { type: string, format: date-time, nullable: true }
 *               description: { type: string, nullable: true }
 *               photos:
 *                 type: array
 *                 items: { type: string, format: uri }
 *               line_items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string, nullable: true }
 *                     description: { type: string, nullable: true }
 *                     unit_price: { type: number }
 *                     total: { type: number }
 *               manual_subtotal: { type: number, nullable: true }
 *               discount_percent: { type: number, nullable: true }
 *               tax_percent: { type: number, nullable: true }
 *               deposit_percent: { type: number, nullable: true }
 *               total_amount: { type: number, nullable: true }
 *               deposit_amount: { type: number, nullable: true }
 *               payment_due_terms: { type: string, nullable: true }
 *               notes: { type: string, nullable: true }
 */
router.post('/invoices', requireFields(['business_id']), requireBusinessAccess('body'), billingController.createInvoice);

/**
 * @swagger
 * /api/billing/invoices/{id}:
 *   patch:
 *     summary: Update an invoice
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customer_id: { type: string, format: uuid, nullable: true }
 *               job_id: { type: string, format: uuid, nullable: true }
 *               service_name: { type: string, nullable: true }
 *               service_category: { type: string, nullable: true }
 *               custom_category_name: { type: string, nullable: true }
 *               contract_type:
 *                 type: object
 *                 additionalProperties: true
 *               warranty_due: { type: string, format: date-time, nullable: true }
 *               description: { type: string, nullable: true }
 *               photos:
 *                 type: array
 *                 items: { type: string, format: uri }
 *               line_items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string, nullable: true }
 *                     description: { type: string, nullable: true }
 *                     unit_price: { type: number }
 *                     total: { type: number }
 *               manual_subtotal: { type: number, nullable: true }
 *               discount_percent: { type: number, nullable: true }
 *               tax_percent: { type: number, nullable: true }
 *               deposit_percent: { type: number, nullable: true }
 *               total_amount: { type: number, nullable: true }
 *               deposit_amount: { type: number, nullable: true }
 *               payment_due_terms: { type: string, nullable: true }
 *               notes: { type: string, nullable: true }
 */
router.patch('/invoices/:id', validateUUID('id'), requireResourceAccess('invoice'), billingController.updateInvoice);

/**
 * @swagger
 * /api/billing/invoices/{id}/send:
 *   post:
 *     summary: Send invoice to customer
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 */
router.post('/invoices/:id/send', validateUUID('id'), requireResourceAccess('invoice'), billingController.sendInvoice);

/**
 * @swagger
 * /api/billing/invoices/{id}/void:
 *   post:
 *     summary: Void an invoice
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 */
router.post('/invoices/:id/void', validateUUID('id'), requireResourceAccess('invoice'), billingController.voidInvoice);

/**
 * @swagger
 * /api/billing/invoices/{id}/refund:
 *   post:
 *     summary: Refund an invoice
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 */
router.post('/invoices/:id/refund', validateUUID('id'), requireResourceAccess('invoice'), billingController.refundInvoice);

// --- Payments ---

/**
 * @swagger
 * /api/billing/payments/{invoiceId}:
 *   post:
 *     summary: Process payment for an invoice
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 */
router.post('/payments/:invoiceId', validateUUID('invoiceId'), requireResourceAccess('invoice', { field: 'invoiceId' }), requireFields(['amount']), billingController.processPayment);

// --- Expenses ---

/**
 * @swagger
 * /api/billing/expenses:
 *   get:
 *     summary: Get all expenses
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 */
router.get('/expenses', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), billingController.getExpenses);

/**
 * @swagger
 * /api/billing/expenses:
 *   post:
 *     summary: Create a new expense
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 */
router.post('/expenses', requireFields(['business_id', 'amount']), requireBusinessAccess('body'), billingController.createExpense);

/**
 * @swagger
 * /api/billing/expenses/{id}:
 *   patch:
 *     summary: Update an expense
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/expenses/:id', validateUUID('id'), requireResourceAccess('expense'), billingController.updateExpense);

/**
 * @swagger
 * /api/billing/expenses/{id}:
 *   delete:
 *     summary: Delete an expense
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/expenses/:id', validateUUID('id'), requireResourceAccess('expense'), billingController.deleteExpense);

module.exports = router;
