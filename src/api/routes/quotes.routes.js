
const { Router } = require('express');
const quoteController = require('../../domains/quotes/quote.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);


router.get('/', quoteController.getAll);
router.get('/:id', validateUUID('id'), quoteController.getById);


router.post('/', requireFields(['business_id', 'customer_id']), quoteController.create);
router.patch('/:id', validateUUID('id'), quoteController.update);


router.post('/:id/send', validateUUID('id'), quoteController.sendQuote);


router.post('/:id/approve', validateUUID('id'), quoteController.approve);


router.post('/:id/decline', validateUUID('id'), quoteController.decline);
router.delete('/:id', validateUUID('id'), quoteController.remove);

module.exports = router;
