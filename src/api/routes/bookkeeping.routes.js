const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const txCtrl = require('../../domains/bookkeeping/bank_transaction.controller');
const ruleCtrl = require('../../domains/bookkeeping/categorization_rule.controller');
const receiptOcrCtrl = require('../../domains/bookkeeping/receipt_ocr.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

const uploadDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 16);
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1,
  },
});

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
 *     summary: Upload a receipt and extract vendor and amount
 *     tags: [Bookkeeping]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Receipt uploaded and parsed
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
router.post('/receipt-ocr', receiptUpload.single('file'), receiptOcrCtrl.processReceipt);

// Categorization Rules
router.get('/rules', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), ruleCtrl.list);
router.get('/rules/:id', validateUUID('id'), requireResourceAccess('categorizationRule'), ruleCtrl.show);
router.post('/rules', requireFields(['business_id'], 'body'), requireBusinessAccess('body'), ruleCtrl.create);
router.patch('/rules/:id', validateUUID('id'), requireResourceAccess('categorizationRule'), ruleCtrl.update);
router.delete('/rules/:id', validateUUID('id'), requireResourceAccess('categorizationRule'), ruleCtrl.remove);

module.exports = router;
