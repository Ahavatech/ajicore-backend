const { Router } = require('express');
const txCtrl = require('../../domains/bookkeeping/bank_transaction.controller');
const ruleCtrl = require('../../domains/bookkeeping/categorization_rule.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

// Bank Transactions
router.get('/transactions', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), txCtrl.list);
router.get('/transactions/summary', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), txCtrl.summary);
router.get('/transactions/:id', validateUUID('id'), requireResourceAccess('bankTransaction'), txCtrl.show);
router.post('/transactions', requireFields(['business_id'], 'body'), requireBusinessAccess('body'), txCtrl.create);
router.post('/transactions/bulk', requireFields(['business_id', 'transactions'], 'body'), requireBusinessAccess('body'), txCtrl.bulkCreate);
router.patch('/transactions/:id', validateUUID('id'), requireResourceAccess('bankTransaction'), txCtrl.update);
router.patch('/transactions/:id/categorize', validateUUID('id'), requireResourceAccess('bankTransaction'), txCtrl.categorize);
router.delete('/transactions/:id', validateUUID('id'), requireResourceAccess('bankTransaction'), txCtrl.remove);

// Categorization Rules
router.get('/rules', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), ruleCtrl.list);
router.get('/rules/:id', validateUUID('id'), requireResourceAccess('categorizationRule'), ruleCtrl.show);
router.post('/rules', requireFields(['business_id'], 'body'), requireBusinessAccess('body'), ruleCtrl.create);
router.patch('/rules/:id', validateUUID('id'), requireResourceAccess('categorizationRule'), ruleCtrl.update);
router.delete('/rules/:id', validateUUID('id'), requireResourceAccess('categorizationRule'), ruleCtrl.remove);

module.exports = router;
