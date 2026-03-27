
const { Router } = require('express');
const quoteController = require('../../domains/quotes/quote.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);


router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), quoteController.getAll);
router.get('/:id', validateUUID('id'), requireResourceAccess('quote'), quoteController.getById);


router.post('/', requireFields(['business_id', 'customer_id']), requireBusinessAccess('body'), quoteController.create);
router.patch('/:id', validateUUID('id'), requireResourceAccess('quote'), quoteController.update);


router.post('/:id/send', validateUUID('id'), requireResourceAccess('quote'), quoteController.sendQuote);


router.post('/:id/approve', validateUUID('id'), requireResourceAccess('quote'), quoteController.approve);


router.post('/:id/decline', validateUUID('id'), requireResourceAccess('quote'), quoteController.decline);
router.delete('/:id', validateUUID('id'), requireResourceAccess('quote'), quoteController.remove);

module.exports = router;
