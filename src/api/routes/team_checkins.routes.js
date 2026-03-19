const { Router } = require('express');
const ctrl = require('../../domains/team_checkins/team_checkin.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.show);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.post('/:id/receive', ctrl.receive);
router.post('/:id/escalate', ctrl.escalate);
router.delete('/:id', ctrl.remove);

module.exports = router;
