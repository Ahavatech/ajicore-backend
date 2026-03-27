const { Router } = require('express');
const ctrl = require('../../domains/ai_logs/ai_event_log.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), ctrl.list);
router.get('/event-types', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), ctrl.eventTypes);
router.get('/:id', validateUUID('id'), requireResourceAccess('aiEventLog', { notFoundLabel: 'AI log entry' }), ctrl.show);
router.post('/', requireFields(['business_id', 'event_type'], 'body'), requireBusinessAccess('body'), ctrl.create);

module.exports = router;
