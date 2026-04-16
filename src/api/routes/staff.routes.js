/**
 * Staff Routes
 */

/**
 * @swagger
 * tags:
 *   name: Team
 *   description: Team members, timesheets, payroll, and clock events
 */

const { Router } = require('express');
const staffController = require('../../domains/team/staff.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/staff/available:
 *   get:
 *     summary: Get available staff members for assignment
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: start_time
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: end_time
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: exclude_job_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: include_future
 *         schema: { type: boolean }
 *         description: Include staff not currently clocked in for future job scheduling
 *     responses:
 *       200:
 *         description: Available staff members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StaffMember'
 */
router.get('/available', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), staffController.getAvailableStaff);

/**
 * @swagger
 * /api/staff:
 *   get:
 *     summary: Get all staff members
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Staff list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StaffMember'
 */
router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), staffController.getAllStaff);

/**
 * @swagger
 * /api/staff/payroll:
 *   get:
 *     summary: Calculate payroll for staff
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payroll summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PayrollSummary'
 */
router.get('/payroll', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), staffController.calculatePayroll);

/**
 * @swagger
 * /api/staff/timesheets:
 *   get:
 *     summary: Get staff timesheets
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Timesheets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Timesheet'
 */
router.get('/timesheets', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), staffController.getTimesheets);

/**
 * @swagger
 * /api/staff/{id}:
 *   get:
 *     summary: Get a staff member by ID
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Staff member retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StaffMember'
 */
router.get('/:id', validateUUID('id'), requireResourceAccess('staff'), staffController.getStaffById);

/**
 * @swagger
 * /api/staff:
 *   post:
 *     summary: Create a new staff member
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StaffInput'
 *     responses:
 *       201:
 *         description: Staff member created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StaffMember'
 */
router.post('/', requireFields(['business_id', 'name', 'hourly_rate']), requireBusinessAccess('body'), staffController.createStaff);

/**
 * @swagger
 * /api/staff/{id}:
 *   patch:
 *     summary: Update a staff member
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
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
 *             $ref: '#/components/schemas/StaffUpdateInput'
 *     responses:
 *       200:
 *         description: Staff member updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StaffMember'
 */
router.patch('/:id', validateUUID('id'), requireResourceAccess('staff'), staffController.updateStaff);

/**
 * @swagger
 * /api/staff/{id}:
 *   delete:
 *     summary: Delete a staff member
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Staff member deleted successfully
 */
router.delete('/:id', validateUUID('id'), requireResourceAccess('staff'), staffController.deleteStaff);

/**
 * @swagger
 * /api/staff/{id}/clock-in:
 *   post:
 *     summary: Clock in a staff member
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Staff member clocked in successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Timesheet'
 */
router.post('/:id/clock-in', validateUUID('id'), requireResourceAccess('staff'), staffController.clockIn);

/**
 * @swagger
 * /api/staff/{id}/clock-out:
 *   post:
 *     summary: Clock out a staff member
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Staff member clocked out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Timesheet'
 */
router.post('/:id/clock-out', validateUUID('id'), requireResourceAccess('staff'), staffController.clockOut);

module.exports = router;
