/**
 * Swagger/OpenAPI documentation for auth endpoints.
 *
 * Onboarding flow:
 *   POST /signup or /google     → Step 1: create account
 *   POST /onboarding/step2      → Step 2: org contact info
 *   POST /onboarding/send-otp   → 2→3: send SMS OTP
 *   POST /onboarding/verify-otp → 2→3: verify OTP, advance to step 3
 *   POST /onboarding/skip-otp   → 2→3: skip phone verification
 *   GET  /onboarding/available-numbers → Step 3 prep: search AI numbers
 *   POST /onboarding/step3      → Step 3: provision AI number
 *   POST /onboarding/skip3      → Skip step 3
 *   POST /onboarding/step4      → Step 4: service area setup
 *   POST /onboarding/step5      → Step 5: logo upload (completes onboarding)
 */

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication, account management, and onboarding
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new account (email + password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: Account created — returns JWT and onboarding_step 1
 *       409:
 *         description: Email already in use
 */

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Sign up or sign in with a Google account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [google_id, email]
 *             properties:
 *               google_id:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Existing Google user signed in
 *       201:
 *         description: New Google user created
 */

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signed in — returns JWT, user, and onboarding_step
 *       401:
 *         description: Invalid credentials
 */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile object
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auth/change-password:
 *   patch:
 *     tags: [Auth]
 *     summary: Change account password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       401:
 *         description: Incorrect current password
 */

// ============================================
// Onboarding Steps
// ============================================

/**
 * @swagger
 * /api/auth/onboarding/step2:
 *   post:
 *     tags: [Auth]
 *     summary: "Step 2: Organization contact info"
 *     description: |
 *       Sets the user's name and business details.
 *       Advances onboarding_step to 2 (ready for OTP verification).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, company_name, company_email, business_structure]
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               company_name:
 *                 type: string
 *               company_email:
 *                 type: string
 *                 format: email
 *               company_type:
 *                 type: string
 *                 example: HVAC
 *               business_structure:
 *                 type: string
 *                 enum: [sole_proprietorship, partnership, llc, corporation, s_corporation, nonprofit, other]
 *     responses:
 *       200:
 *         description: Step 2 complete — returns user, business, and onboarding_step 2
 */

/**
 * @swagger
 * /api/auth/onboarding/send-otp:
 *   post:
 *     tags: [Auth]
 *     summary: "OTP: Send SMS verification code to phone number"
 *     description: |
 *       Generates a 5-digit OTP valid for 10 minutes, saves the phone number
 *       to the business record, and sends the code via SMS (Twilio).
 *
 *       **Development mode:** When Twilio credentials are not configured, the
 *       OTP is returned in `dev_otp` for testing — never present in production.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone_number]
 *             properties:
 *               phone_number:
 *                 type: string
 *                 description: E.164 format preferred
 *                 example: "+12125551234"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 phone_number:
 *                   type: string
 *                   description: Masked phone number for display
 *                 dev_otp:
 *                   type: string
 *                   description: "Dev only: the actual OTP for testing"
 *       400:
 *         description: phone_number is required
 */

/**
 * @swagger
 * /api/auth/onboarding/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: "OTP: Verify the SMS code and advance to step 3"
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp:
 *                 type: string
 *                 description: 5-digit code received via SMS
 *                 example: "84321"
 *     responses:
 *       200:
 *         description: OTP verified — onboarding_step advances to 3
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                 onboarding_step:
 *                   type: integer
 *                   example: 3
 *       400:
 *         description: Invalid, expired, or missing OTP
 */

/**
 * @swagger
 * /api/auth/onboarding/skip-otp:
 *   post:
 *     tags: [Auth]
 *     summary: "OTP: Skip phone verification and advance to step 3"
 *     description: |
 *       The user can skip phone verification. Advances onboarding_step to 3.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Phone verification skipped — onboarding_step 3
 */

/**
 * @swagger
 * /api/auth/onboarding/available-numbers:
 *   get:
 *     tags: [Auth]
 *     summary: "Step 3 prep: Search available AI phone numbers"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [local, toll_free]
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *       - in: query
 *         name: area_code
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of available numbers
 */

/**
 * @swagger
 * /api/auth/onboarding/step3:
 *   post:
 *     tags: [Auth]
 *     summary: "Step 3: Provision an AI business phone number"
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone_number, search_type]
 *             properties:
 *               phone_number:
 *                 type: string
 *               search_type:
 *                 type: string
 *                 enum: [local, toll_free]
 *     responses:
 *       200:
 *         description: AI number provisioned — onboarding_step 3
 */

/**
 * @swagger
 * /api/auth/onboarding/skip3:
 *   post:
 *     tags: [Auth]
 *     summary: "Step 3: Skip AI number setup"
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Step skipped — onboarding_step 4
 */

/**
 * @swagger
 * /api/auth/onboarding/step4:
 *   post:
 *     tags: [Auth]
 *     summary: "Step 4: Service area setup"
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [home_base_zip, service_radius_miles, cost_per_mile_over_radius]
 *             properties:
 *               home_base_zip:
 *                 type: string
 *               service_radius_miles:
 *                 type: number
 *               cost_per_mile_over_radius:
 *                 type: number
 *     responses:
 *       200:
 *         description: Service area saved — onboarding_step 4
 */

/**
 * @swagger
 * /api/auth/onboarding/step5:
 *   post:
 *     tags: [Auth]
 *     summary: "Step 5: Upload business logo (completes onboarding)"
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               logo_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Onboarding complete — onboarding_completed true
 */

module.exports = {};
