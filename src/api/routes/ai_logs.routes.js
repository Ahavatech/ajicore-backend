const { Router } = require('express');
const ctrl = require('../../domains/ai_logs/ai_event_log.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/event-types', ctrl.eventTypes);
router.get('/:id', ctrl.show);
router.post('/', ctrl.create);

module.exports = router;
