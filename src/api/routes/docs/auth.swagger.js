/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and onboarding
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Create account with email and password
 *     tags: [Auth]
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
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: StrongPassword123
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Account created successfully.
 *               token: jwt_token_here
 *               onboarding_step: 2
 *               is_new: true
 */

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Create account or sign in with Google
 *     tags: [Auth]
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
 *                 example: google-oauth-id
 *               email:
 *                 type: string
 *                 example: user@gmail.com
 *               first_name:
 *                 type: string
 *                 example: John
 *               last_name:
 *                 type: string
 *                 example: Doe
 *     responses:
 *       200:
 *         description: Signed in successfully
 *       201:
 *         description: Account created successfully
 */

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     summary: Sign in with email and password
 *     tags: [Auth]
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
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: StrongPassword123
 *     responses:
 *       200:
 *         description: Sign in successful
 *         content:
 *           application/json:
 *             example:
 *               token: jwt_token_here
 *               user:
 *                 id: "uuid"
 *                 email: user@example.com
 */

/**
 * @swagger
 * /api/auth/onboarding/step2:
 *   post:
 *     summary: Submit organization contact info
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, company_name]
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: John
 *               last_name:
 *                 type: string
 *                 example: Doe
 *               company_name:
 *                 type: string
 *                 example: FixIt Services
 *     responses:
 *       200:
 *         description: Step 2 completed
 */

/**
 * @swagger
 * /api/auth/onboarding/step3:
 *   post:
 *     summary: Submit organization address
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [street, city, postal_code, country]
 *             properties:
 *               street:
 *                 type: string
 *                 example: 123 Main Street
 *               city:
 *                 type: string
 *                 example: Lagos
 *               postal_code:
 *                 type: string
 *                 example: 100001
 *               country:
 *                 type: string
 *                 example: Nigeria
 *     responses:
 *       200:
 *         description: Step 3 completed
 */

/**
 * @swagger
 * /api/auth/onboarding/step4:
 *   post:
 *     summary: Upload organization logo
 *     tags: [Auth]
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
 *                 example: https://example.com/logo.png
 *     responses:
 *       200:
 *         description: Step 4 completed
 */

/**
 * @swagger
 * /api/auth/onboarding/step5:
 *   post:
 *     summary: Set up AI business number
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone_number:
 *                 type: string
 *                 example: "+2348012345678"
 *     responses:
 *       200:
 *         description: Step 5 completed
 */

/**
 * @swagger
 * /api/auth/onboarding/skip5:
 *   post:
 *     summary: Skip AI number setup
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Step skipped successfully
 */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             example:
 *               id: "uuid"
 *               email: user@example.com
 *               onboarding_step: 3
 */

/**
 * @swagger
 * /api/auth/change-password:
 *   patch:
 *     summary: Change user password
 *     tags: [Auth]
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
 *                 example: OldPassword123
 *               new_password:
 *                 type: string
 *                 example: NewPassword456
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Password updated successfully.
 */