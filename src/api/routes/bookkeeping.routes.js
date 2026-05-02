const { Router } = require('express');
const txCtrl = require('../../domains/bookkeeping/bank_transaction.controller');
const ruleCtrl = require('../../domains/bookkeeping/categorization_rule.controller');
const receiptOcrCtrl = require('../../domains/bookkeeping/receipt_ocr.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

// Bank Transactions
/**
 * @swagger
 * /api/bookkeeping/transactions:
 *   get:
 *     summary: Fetch bookkeeping transactions
 *     tags: [Bookkeeping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Transaction list
 */
router.get('/transactions', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), txCtrl.list);

/**
 * @swagger
 * /api/bookkeeping/transactions/summary:
 *   get:
 *     summary: Fetch financial summary
 *     tags: [Bookkeeping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Revenue and expense summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRevenue: { type: number }
 *                 totalExpenses: { type: number }
 *                 netProfit: { type: number }
 */
router.get('/transactions/summary', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), txCtrl.summary);

/**
 * @swagger
 * /api/bookkeeping/transactions/{id}:
 *   get:
 *     summary: Fetch a single bookkeeping transaction
 *     tags: [Bookkeeping]
 *     security:
 *       - bearerAuth: []
 */
router.get('/transactions/:id', validateUUID('id'), requireResourceAccess('bankTransaction'), txCtrl.show);

/**
 * @swagger
 * /api/bookkeeping/transactions:
 *   post:
 *     summary: Create a bookkeeping transaction
 *     tags: [Bookkeeping]
 *     security:
 *       - bearerAuth: []
 */
router.post('/transactions', requireFields(['business_id'], 'body'), requireBusinessAccess('body'), txCtrl.create);

/**
 * @swagger
 * /api/bookkeeping/transactions/bulk:
 *   post:
 *     summary: Create bookkeeping transactions in bulk
 *     tags: [Bookkeeping]
 *     security:
 *       - bearerAuth: []
 */
router.post('/transactions/bulk', requireFields(['business_id', 'transactions'], 'body'), requireBusinessAccess('body'), txCtrl.bulkCreate);

/**
 * @swagger
 * /api/bookkeeping/transactions/import:
 *   post:
 *     summary: Import bookkeeping transactions from an uploaded CSV or TSV file URL
 *     tags: [Bookkeeping]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, file_url]
 *             properties:
 *               business_id:
 *                 type: string
 *                 format: uuid
 *               file_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: Transactions imported successfully
 */
router.post('/transactions/import', requireFields(['business_id', 'file_url'], 'body'), requireBusinessAccess('body'), txCtrl.importTransactions);

/**
 * @swagger
 * /api/bookkeeping/transactions/{id}:
 *   patch:
 *     summary: Update a bookkeeping transaction
 *     tags: [Bookkeeping]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/transactions/:id', validateUUID('id'), requireResourceAccess('bankTransaction'), txCtrl.update);

/**
 * @swagger
 * /api/bookkeeping/transactions/{id}/categorize:
 *   patch:
 *     summary: Categorize a bookkeeping transaction
 *     tags: [Bookkeeping]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/transactions/:id/categorize', validateUUID('id'), requireResourceAccess('bankTransaction'), txCtrl.categorize);

/**
 * @swagger
 * /api/bookkeeping/transactions/{id}:
 *   delete:
 *     summary: Delete a bookkeeping transaction
 *     tags: [Bookkeeping]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/transactions/:id', validateUUID('id'), requireResourceAccess('bankTransaction'), txCtrl.remove);

/**
 * @swagger
 * /api/bookkeeping/receipt-ocr:
 *   post:
 *     summary: Create a bookkeeping transaction from an uploaded receipt URL
 *     tags: [Bookkeeping]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, file_url]
 *             properties:
 *               business_id:
 *                 type: string
 *                 format: uuid
 *               file_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: Receipt parsed into an uncategorized bookkeeping transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url: { type: string }
 *                 extracted_data:
 *                   type: object
 *                   properties:
 *                     vendor: { type: string }
 *                     amount: { type: number }
 */
router.post('/receipt-ocr', requireFields(['business_id', 'file_url'], 'body'), requireBusinessAccess('body'), receiptOcrCtrl.processReceipt);

// Categorization Rules
router.get('/rules', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), ruleCtrl.list);
router.get('/rules/:id', validateUUID('id'), requireResourceAccess('categorizationRule'), ruleCtrl.show);
router.post('/rules', requireFields(['business_id'], 'body'), requireBusinessAccess('body'), ruleCtrl.create);
router.patch('/rules/:id', validateUUID('id'), requireResourceAccess('categorizationRule'), ruleCtrl.update);
router.delete('/rules/:id', validateUUID('id'), requireResourceAccess('categorizationRule'), ruleCtrl.remove);

module.exports = router;
