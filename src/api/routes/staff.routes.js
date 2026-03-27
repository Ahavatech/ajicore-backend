/**
 * Staff Routes
 */

/**
 * @swagger
 * tags:
 *   name: Staff
 *   description: Staff management, timesheets, and payroll
 */

const { Router } = require('express');
const staffController = require('../../domains/team/staff.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/staff:
 *   get:
 *     summary: Get all staff members
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), staffController.getAllStaff);

/**
 * @swagger
 * /api/staff/payroll:
 *   get:
 *     summary: Calculate payroll for staff
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 */
router.get('/payroll', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), staffController.calculatePayroll);

/**
 * @swagger
 * /api/staff/timesheets:
 *   get:
 *     summary: Get staff timesheets
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 */
router.get('/timesheets', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), staffController.getTimesheets);

/**
 * @swagger
 * /api/staff/{id}:
 *   get:
 *     summary: Get a staff member by ID
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id', validateUUID('id'), requireResourceAccess('staff'), staffController.getStaffById);

/**
 * @swagger
 * /api/staff:
 *   post:
 *     summary: Create a new staff member
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', requireFields(['business_id', 'name', 'hourly_rate']), requireBusinessAccess('body'), staffController.createStaff);

/**
 * @swagger
 * /api/staff/{id}:
 *   patch:
 *     summary: Update a staff member
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id', validateUUID('id'), requireResourceAccess('staff'), staffController.updateStaff);

/**
 * @swagger
 * /api/staff/{id}:
 *   delete:
 *     summary: Delete a staff member
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', validateUUID('id'), requireResourceAccess('staff'), staffController.deleteStaff);

/**
 * @swagger
 * /api/staff/{id}/clock-in:
 *   post:
 *     summary: Clock in a staff member
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/clock-in', validateUUID('id'), requireResourceAccess('staff'), staffController.clockIn);

/**
 * @swagger
 * /api/staff/{id}/clock-out:
 *   post:
 *     summary: Clock out a staff member
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/clock-out', validateUUID('id'), requireResourceAccess('staff'), staffController.clockOut);

module.exports = router;
