const { Router } = require('express');
const txCtrl = require('../../domains/bookkeeping/bank_transaction.controller');
const ruleCtrl = require('../../domains/bookkeeping/categorization_rule.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = Router();
router.use(requireAuth);

// Bank Transactions
router.get('/transactions', txCtrl.list);
router.get('/transactions/summary', txCtrl.summary);
router.get('/transactions/:id', txCtrl.show);
router.post('/transactions', txCtrl.create);
router.post('/transactions/bulk', txCtrl.bulkCreate);
router.patch('/transactions/:id', txCtrl.update);
router.patch('/transactions/:id/categorize', txCtrl.categorize);
router.delete('/transactions/:id', txCtrl.remove);

// Categorization Rules
router.get('/rules', ruleCtrl.list);
router.get('/rules/:id', ruleCtrl.show);
router.post('/rules', ruleCtrl.create);
router.patch('/rules/:id', ruleCtrl.update);
router.delete('/rules/:id', ruleCtrl.remove);

module.exports = router;
