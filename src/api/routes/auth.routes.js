
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

/**
 * @swagger
 * /api/auth/onboarding/available-numbers:
 *   get:
 *     summary: Search available Twilio phone numbers by city, area code, or toll-free
 *     description: |
 *       **Onboarding Step 3 - Search Phase**
 *       
 *       Query Twilio for available phone numbers before provisioning.
 *       Returns up to 5 numbers with their capabilities and location details.
 *       
 *       **Search Types:**
 *       - `city`: Search by city name (requires city parameter)
 *       - `area_code`: Search by 3-digit area code (requires area_code parameter, auto-sanitized)
 *       - `toll_free`: Search toll-free numbers (no additional parameters needed)
 *       
 *       **Number Format:**
 *       All returned numbers are in E.164 format (+[country code][digits]).
 *       
 *       **Rate Limiting:**
 *       Consider implementing rate limiting on this endpoint as Twilio API calls are expensive.
 *     tags:
 *       - Onboarding
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: ['city', 'area_code', 'toll_free']
 *         description: Search type for available numbers
 *       - name: city
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           example: 'Washington'
 *         description: City name (required if type=city, e.g., "Washington", "NewYork", "SanFrancisco")
 *       - name: area_code
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           example: '202'
 *         description: 3-digit area code (required if type=area_code, e.g., "202", "212", "415"). Non-digits are auto-removed.
 *     responses:
 *       200:
 *         description: Successfully retrieved available phone numbers
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetAvailableNumbersResponse'
 *             example:
 *               type: 'city'
 *               country: 'US'
 *               count: 2
 *               numbers:
 *                 - phone_number: '+12025551234'
 *                   friendly_name: 'US/United States'
 *                   locality: 'Washington'
 *                   region: 'DC'
 *                   postal_code: '20001'
 *                   country: 'US'
 *                   capabilities:
 *                     voice: true
 *                     sms: true
 *                     mms: false
 *                   type: 'local'
 *                   area_code: '202'
 *                 - phone_number: '+12025555678'
 *                   friendly_name: 'US/United States'
 *                   locality: 'Washington'
 *                   region: 'DC'
 *                   postal_code: '20001'
 *                   country: 'US'
 *                   capabilities:
 *                     voice: true
 *                     sms: true
 *                     mms: true
 *                   type: 'local'
 *                   area_code: '202'
 *       400:
 *         description: Invalid search parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: 'string' }
 *             examples:
 *               invalid_type:
 *                 value:
 *                   error: 'type must be one of: city, area_code, toll_free'
 *               missing_city:
 *                 value:
 *                   error: 'city is required when type is city.'
 *               invalid_area_code:
 *                 value:
 *                   error: 'area_code must be a 3-digit code.'
 *       503:
 *         description: Twilio API unavailable or error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: 'string' }
 *             example:
 *               error: 'Unable to fetch available Twilio phone numbers right now.'
 */
router.get(
  '/onboarding/available-numbers',
  requireAuth,
  authController.getAvailableNumbers
);

/**
 * @swagger
 * /api/auth/onboarding/step3:
 *   post:
 *     summary: Provision selected AI business phone number (Twilio)
 *     description: |
 *       **Onboarding Step 3 - Provisioning Phase**
 *       
 *       Reserve and configure a phone number from Twilio for the business.
 *       
 *       **Flow:**
 *       1. Validate E.164 phone number format
 *       2. Reserve number in Twilio account
 *       3. Configure SMS/voice webhooks (if configured)
 *       4. Add to Twilio Messaging Service (if SID provided)
 *       5. Save to database (atomic transaction)
 *       6. Advance user to step 4
 *       
 *       **On Failure:**
 *       - If provisioning fails at any step, the number is automatically released back to Twilio
 *       - User remains on step 3 and can retry with a different number
 *       - Database transaction ensures no partial updates
 *       
 *       **Phone Number Format:**
 *       Must be in E.164 format: `+[country code][digits]` (e.g., `+12025551234`)
 *       
 *       **Database Updates:**
 *       - `business.ai_phone_number` → provisioned number
 *       - `business.dedicated_phone_number` → same as above
 *       - `business.ai_phone_country` → ISO country code (e.g., "US")
 *       - `business.ai_phone_area_code` → extracted area code (e.g., "202")
 *       - `business.twilio_phone_sid` → Twilio service identifier
 *       - `business.twilio_phone_friendly_name` → "Company Name - +1234567890"
 *       - `user.onboarding_step` → 4
 *     tags:
 *       - Onboarding
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OnboardingStep3Input'
 *           example:
 *             phone_number: '+12025551234'
 *             search_type: 'city'
 *     responses:
 *       200:
 *         description: Phone number successfully provisioned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnboardingStep3Response'
 *             example:
 *               message: 'AI business number provisioned.'
 *               user:
 *                 id: '550e8400-e29b-41d4-a716-446655440000'
 *                 email: 'owner@example.com'
 *                 onboarding_step: 4
 *               business:
 *                 id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
 *                 name: 'Acme Corp'
 *                 ai_phone_number: '+12025551234'
 *                 dedicated_phone_number: '+12025551234'
 *                 ai_phone_country: 'US'
 *                 ai_phone_area_code: '202'
 *                 twilio_phone_sid: 'PNxxxxxxxxxxxx'
 *                 twilio_phone_friendly_name: 'Acme Corp - +12025551234'
 *               ai_phone_number: '+12025551234'
 *               twilio_phone_sid: 'PNxxxxxxxxxxxx'
 *               onboarding_step: 4
 *       400:
 *         description: Invalid input or business state
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: 'string' }
 *             examples:
 *               missing_field:
 *                 value:
 *                   error: 'phone_number is required.'
 *               invalid_format:
 *                 value:
 *                   error: 'phone_number must be a valid E.164 phone number.'
 *               already_provisioned:
 *                 value:
 *                   error: 'This business already has a provisioned Twilio number.'
 *               no_business:
 *                 value:
 *                   error: 'No business found. Please complete step 2 first.'
 *       503:
 *         description: Twilio provisioning error or database failure
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: 'string' }
 *             examples:
 *               twilio_error:
 *                 value:
 *                   error: 'Unable to provision the selected Twilio phone number.'
 *               db_error:
 *                 value:
 *                   error: 'Database error (number automatically released)'
 */
router.post(
  '/onboarding/step3',
  requireAuth,
  requireFields(['phone_number', 'search_type']),
  authController.onboardingStep3
);

/**
 * @swagger
 * /api/auth/onboarding/skip3:
 *   post:
 *     summary: Skip AI phone number setup (optional)
 *     description: |
 *       **Onboarding Step 3 - Skip Option**
 *       
 *       Allow users to skip AI phone number provisioning and proceed to step 4 (service area setup).
 *       
 *       **When to Use:**
 *       - User doesn't want an AI-powered number yet
 *       - User will set up AI number later
 *       - User wants to use existing business phone number
 *       
 *       **Result:**
 *       - `business.ai_phone_number` remains NULL
 *       - User advanced to step 4
 *       - User can re-do step 3 later to provision a number
 *     tags:
 *       - Onboarding
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Step 3 skipped successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnboardingSkip3Response'
 *             example:
 *               message: 'AI number setup skipped.'
 *               user:
 *                 id: '550e8400-e29b-41d4-a716-446655440000'
 *                 email: 'owner@example.com'
 *                 onboarding_step: 4
 *               onboarding_step: 4
 */
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
