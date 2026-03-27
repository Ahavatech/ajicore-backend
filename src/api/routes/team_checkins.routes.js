const { Router } = require('express');
const ctrl = require('../../domains/team_checkins/team_checkin.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), ctrl.list);
router.get('/:id', validateUUID('id'), requireResourceAccess('teamCheckin', { notFoundLabel: 'team check-in' }), ctrl.show);
router.post(
  '/',
  requireFields(['staff_id', 'scheduled_at'], 'body'),
  requireResourceAccess('staff', { source: 'body', field: 'staff_id', notFoundLabel: 'staff member' }),
  ctrl.create
);
router.patch('/:id', validateUUID('id'), requireResourceAccess('teamCheckin', { notFoundLabel: 'team check-in' }), ctrl.update);
router.post('/:id/receive', validateUUID('id'), requireResourceAccess('teamCheckin', { notFoundLabel: 'team check-in' }), ctrl.receive);
router.post('/:id/escalate', validateUUID('id'), requireResourceAccess('teamCheckin', { notFoundLabel: 'team check-in' }), ctrl.escalate);
router.delete('/:id', validateUUID('id'), requireResourceAccess('teamCheckin', { notFoundLabel: 'team check-in' }), ctrl.remove);

module.exports = router;
