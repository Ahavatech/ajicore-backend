
const { Router } = require('express');
const customerController = require('../../domains/customers/customer.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);


router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), customerController.getAll);


router.get('/lookup', requireFields(['business_id', 'phone'], 'query'), requireBusinessAccess('query'), customerController.findByPhone);


router.get('/:id', validateUUID('id'), requireResourceAccess('customer'), customerController.getById);


router.get('/:id/history', validateUUID('id'), requireResourceAccess('customer'), customerController.getHistory);


router.post('/', requireFields(['business_id', 'first_name', 'last_name']), requireBusinessAccess('body'), customerController.create);

router.patch('/:id', validateUUID('id'), requireResourceAccess('customer'), customerController.update);


router.delete('/:id', validateUUID('id'), requireResourceAccess('customer'), customerController.remove);

module.exports = router;
