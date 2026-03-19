
const { Router } = require('express');
const customerController = require('../../domains/customers/customer.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);


router.get('/', requireFields(['business_id'], 'query'), customerController.getAll);


router.get('/lookup', requireFields(['business_id', 'phone'], 'query'), customerController.findByPhone);


router.get('/:id', validateUUID('id'), customerController.getById);


router.get('/:id/history', validateUUID('id'), customerController.getHistory);


router.post('/', requireFields(['business_id', 'first_name', 'last_name']), customerController.create);

router.patch('/:id', validateUUID('id'), customerController.update);


router.delete('/:id', validateUUID('id'), customerController.remove);

module.exports = router;
