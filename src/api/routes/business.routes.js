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
const { Router } = require('express');
const businessController = require('../../domains/business/business.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');

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

module.exports = router;
