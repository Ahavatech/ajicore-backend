/**
 * @swagger
 * tags:
 *   name: Business Profile
 *   description: Company profile and general business settings
 */
/**
 * @swagger
 * tags:
 *   name: Alerts
 *   description: Alert preference settings
 */
/**
 * @swagger
 * tags:
 *   name: Automation
 *   description: Reminder and operational automation settings
 */
/**
 * @swagger
 * tags:
 *   name: Communication
 *   description: Communication and AI receptionist settings
 */
/**
 * @swagger
 * tags:
 *   name: Financial Settings
 *   description: Invoice & quote settings, reminders, branding, and Stripe metadata
 */
const { Router } = require('express');

const businessController = require('../../domains/business/business.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/business/profile:
 *   get:
 *     summary: Get business profile
 *     tags: [Business Profile]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Business profile payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessProfileResponse'
 */
router.get('/profile', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), businessController.getProfile);

/**
 * @swagger
 * /api/business/profile:
 *   patch:
 *     summary: Update business profile
 *     tags: [Business Profile]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BusinessProfileUpdateInput'
 *     responses:
 *       200:
 *         description: Updated business profile payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessProfileResponse'
 */
router.patch('/profile', requireFields(['business_id']), requireBusinessAccess('body'), businessController.updateProfile);

/**
 * @swagger
 * /api/business/alerts:
 *   get:
 *     summary: Get alert settings
 *     tags: [Alerts]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Alert settings payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessAlertSettingsResponse'
 */
router.get('/alerts', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), businessController.getAlerts);

/**
 * @swagger
 * /api/business/alerts:
 *   patch:
 *     summary: Update alert settings
 *     tags: [Alerts]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BusinessAlertSettingsUpdateInput'
 *     responses:
 *       200:
 *         description: Updated alert settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessAlertSettingsResponse'
 */
router.patch('/alerts', requireFields(['business_id']), requireBusinessAccess('body'), businessController.updateAlerts);

/**
 * @swagger
 * /api/business/automation:
 *   get:
 *     summary: Get automation settings
 *     tags: [Automation]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Automation settings payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessAutomationSettingsResponse'
 */
router.get('/automation', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), businessController.getAutomation);

/**
 * @swagger
 * /api/business/automation:
 *   patch:
 *     summary: Update automation settings
 *     tags: [Automation]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BusinessAutomationSettingsUpdateInput'
 *     responses:
 *       200:
 *         description: Updated automation settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessAutomationSettingsResponse'
 */
router.patch('/automation', requireFields(['business_id']), requireBusinessAccess('body'), businessController.updateAutomation);

/**
 * @swagger
 * /api/business/communication:
 *   get:
 *     summary: Get communication settings
 *     tags: [Communication]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Communication settings payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessCommunicationSettingsResponse'
 */
router.get('/communication', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), businessController.getCommunication);

/**
 * @swagger
 * /api/business/communication:
 *   patch:
 *     summary: Update communication settings
 *     tags: [Communication]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BusinessCommunicationSettingsUpdateInput'
 *     responses:
 *       200:
 *         description: Updated communication settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessCommunicationSettingsResponse'
 */
router.patch('/communication', requireFields(['business_id']), requireBusinessAccess('body'), businessController.updateCommunication);

/**
 * @swagger
 * /api/business/finance-settings:
 *   get:
 *     summary: Get financial settings
 *     tags: [Financial Settings]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Finance settings payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 business_id: { type: string }
 *                 company_info:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     website: { type: string }
 *                     email: { type: string }
 *                     phone: { type: string }
 *                     logo: { type: string }
 *                     notes: { type: string }
 *                 toggles:
 *                   type: object
 *                   properties:
 *                     website: { type: boolean }
 *                     email: { type: boolean }
 *                     phone: { type: boolean }
 *                     address: { type: boolean }
 *                 reminders:
 *                   type: object
 *                   properties:
 *                     before_3_days: { type: boolean }
 *                     on_due_date: { type: boolean }
 *                     after_3_days: { type: boolean }
 *                     after_7_days: { type: boolean }
 *                 quotes_follow_up:
 *                   type: object
 *                   properties:
 *                     days_2: { type: boolean }
 *                     days_3: { type: boolean }
 *                     days_4: { type: boolean }
 *                     days_7: { type: boolean }
 *                 default_due_date: { type: string }
 *                 stripe_connected: { type: boolean }
 */
router.get('/finance-settings', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), businessController.getFinanceSettings);

/**
 * @swagger
 * /api/business/finance-settings:
 *   patch:
 *     summary: Update financial settings
 *     tags: [Financial Settings]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               business_id: { type: string }
 *               company_info:
 *                 type: object
 *               toggles:
 *                 type: object
 *               reminders:
 *                 type: object
 *               quotes_follow_up:
 *                 type: object
 *               default_due_date: { type: string }
 *     responses:
 *       200:
 *         description: Updated finance settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.patch('/finance-settings', requireFields(['business_id']), requireBusinessAccess('body'), businessController.updateFinanceSettings);

/**
 * Canonical RESTful endpoints (per Definitive Backend API Blueprint)
 */

/**
 * @swagger
 * /api/business/{id}/finance-settings:
 *   get:
 *     summary: Fetch global financial settings for a business
 *     tags: [Financial Settings]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Finance settings payload
 */
router.get('/:id/finance-settings', validateUUID('id'), requireBusinessAccess('params', 'id'), businessController.getFinanceSettingsById);

/**
 * @swagger
 * /api/business/{id}/finance-settings:
 *   patch:
 *     summary: Save global financial settings for a business
 *     tags: [Financial Settings]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Expects the exact schema used by GET finance-settings.
 *     responses:
 *       200:
 *         description: Updated finance settings
 */
router.patch('/:id/finance-settings', validateUUID('id'), requireBusinessAccess('params', 'id'), businessController.updateFinanceSettingsById);

module.exports = router;

