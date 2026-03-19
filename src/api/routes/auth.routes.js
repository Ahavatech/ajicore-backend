
const { Router } = require('express');
const authController = require('../../domains/auth/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');

const router = Router();

// ============================================
// Public Routes
// ============================================

// Step 1: Email + Password signup
router.post(
  '/signup',
  requireFields(['email', 'password']),
  authController.signup
);

// Step 1 (alt): Google OAuth signup/signin
router.post(
  '/google',
  requireFields(['google_id', 'email']),
  authController.googleSignup
);

// Sign in with email + password
router.post(
  '/signin',
  requireFields(['email', 'password']),
  authController.signin
);

// ============================================
// Protected Routes (require Bearer token)
// ============================================

// Step 2: Organization contact info
router.post(
  '/onboarding/step2',
  requireAuth,
  requireFields(['first_name', 'last_name', 'company_name']),
  authController.onboardingStep2
);

// Step 3: Organization address
router.post(
  '/onboarding/step3',
  requireAuth,
  requireFields(['street', 'city', 'postal_code', 'country']),
  authController.onboardingStep3
);

// Step 4: Logo upload (logo_url is optional — user may skip)
router.post(
  '/onboarding/step4',
  requireAuth,
  authController.onboardingStep4
);

// Step 5: AI business number
router.post(
  '/onboarding/step5',
  requireAuth,
  authController.onboardingStep5
);

// Skip step 5
router.post(
  '/onboarding/skip5',
  requireAuth,
  authController.skipStep5
);

// Get current user profile
router.get('/me', requireAuth, authController.getMe);

// Change password
router.patch(
  '/change-password',
  requireAuth,
  requireFields(['current_password', 'new_password']),
  authController.changePassword
);

module.exports = router;