/**
 * Auth Routes
 * Endpoints for user signup, signin, and account management.
 */
const { Router } = require('express');
const authController = require('../../domains/auth/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');

const router = Router();

// POST /api/auth/signup - Register a new user with email
router.post(
  '/signup',
  requireFields(['email', 'password']),
  authController.signup
);

// POST /api/auth/signin - Sign in with email and password
router.post(
  '/signin',
  requireFields(['email', 'password']),
  authController.signin
);

// GET /api/auth/me - Get current authenticated user profile
router.get('/me', requireAuth, authController.getMe);

// PATCH /api/auth/change-password - Change password (authenticated)
router.patch(
  '/change-password',
  requireAuth,
  requireFields(['current_password', 'new_password']),
  authController.changePassword
);

module.exports = router;