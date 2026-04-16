
const { Router } = require('express');
const authController = require('../../domains/auth/auth.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
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

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthForgotPasswordInput'
 *     responses:
 *       200:
 *         description: Reset code request accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthForgotPasswordResponse'
 */
router.post(
  '/forgot-password',
  requireFields(['email']),
  authController.forgotPassword
);

/**
 * @swagger
 * /api/auth/verify-reset-code:
 *   post:
 *     summary: Verify a password reset code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthVerifyResetCodeInput'
 *     responses:
 *       200:
 *         description: Reset code is valid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthVerifyResetCodeResponse'
 */
router.post(
  '/verify-reset-code',
  requireFields(['email', 'code']),
  authController.verifyResetCode
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with a verified code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthResetPasswordInput'
 *     responses:
 *       200:
 *         description: Password reset completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResetPasswordResponse'
 */
router.post(
  '/reset-password',
  requireFields(['email', 'code', 'new_password']),
  authController.resetPassword
);

// ============================================
// Protected Routes (require Bearer token)
// ============================================

// Step 2: Organization contact info
router.post(
  '/onboarding/step2',
  requireAuth,
  requireFields(['first_name', 'last_name', 'company_name', 'company_email', 'business_structure']),
  authController.onboardingStep2
);

// Step 2→3: Send 5-digit OTP to user's phone number
router.post(
  '/onboarding/send-otp',
  requireAuth,
  requireFields(['phone_number']),
  authController.sendOtp
);

// Step 2→3: Verify the OTP and advance to step 3
router.post(
  '/onboarding/verify-otp',
  requireAuth,
  requireFields(['otp']),
  authController.verifyOtp
);

// Step 2→3: Skip phone OTP verification
router.post(
  '/onboarding/skip-otp',
  requireAuth,
  authController.skipOtp
);

// Step 3: Search available AI phone numbers (used before provisioning)
router.get(
  '/onboarding/available-numbers',
  requireAuth,
  authController.getAvailableNumbers
);

// Step 3: Provision AI business number
router.post(
  '/onboarding/step3',
  requireAuth,
  requireFields(['phone_number', 'search_type']),
  authController.onboardingStep3
);

// Step 3: Skip AI number setup
router.post(
  '/onboarding/skip3',
  requireAuth,
  authController.skipStep3
);

// Step 4: Service area setup
router.post(
  '/onboarding/step4',
  requireAuth,
  requireFields(['home_base_zip', 'service_radius_miles', 'cost_per_mile_over_radius']),
  authController.onboardingStep4
);

// Step 5: Logo upload (optional logo_url) — marks onboarding complete
router.post(
  '/onboarding/step5',
  requireAuth,
  authController.onboardingStep5
);

// Get current user profile
router.get('/me', requireAuth, authController.getMe);

router.get(
  '/internal-api-token',
  requireAuth,
  authController.getInternalApiToken
);

// Change password
router.patch(
  '/change-password',
  requireAuth,
  requireFields(['current_password', 'new_password']),
  authController.changePassword
);

module.exports = router;
