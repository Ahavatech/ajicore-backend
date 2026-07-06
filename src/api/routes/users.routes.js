const { Router } = require('express');
const userController = require('../../domains/users/user.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');

const router = Router();

router.use(requireAuth);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.post(
  '/me/change-password',
  requireFields(['current_password', 'new_password']),
  userController.changePassword
);

module.exports = router;
