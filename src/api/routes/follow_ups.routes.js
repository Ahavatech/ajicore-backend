const { Router } = require('express');
const ctrl = require('../../domains/follow_ups/follow_up.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), ctrl.list);
router.get('/:id', validateUUID('id'), requireResourceAccess('followUp'), ctrl.show);
router.post('/', requireFields(['business_id'], 'body'), requireBusinessAccess('body'), ctrl.create);
router.patch('/:id', validateUUID('id'), requireResourceAccess('followUp'), ctrl.update);
router.post('/:id/sent', validateUUID('id'), requireResourceAccess('followUp'), ctrl.markSent);
router.post('/:id/cancel', validateUUID('id'), requireResourceAccess('followUp'), ctrl.cancel);
router.delete('/:id', validateUUID('id'), requireResourceAccess('followUp'), ctrl.remove);

module.exports = router;
