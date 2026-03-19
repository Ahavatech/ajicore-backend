const { Router } = require('express');
const ctrl = require('../../domains/follow_ups/follow_up.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.show);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.post('/:id/sent', ctrl.markSent);
router.post('/:id/cancel', ctrl.cancel);
router.delete('/:id', ctrl.remove);

module.exports = router;
