/**
 * Staff Routes
 * Endpoints for staff management, timesheets, and payroll.
 */
const { Router } = require('express');
const staffController = require('../../domains/team/staff.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();

router.use(requireAuth);

// GET /api/staff - List staff members
router.get('/', staffController.getAllStaff);

// GET /api/staff/payroll - Calculate payroll for a period
router.get('/payroll', staffController.calculatePayroll);

// GET /api/staff/:id - Get staff member details with recent timesheets
router.get('/:id', validateUUID('id'), staffController.getStaffById);

// POST /api/staff - Create a new staff member
router.post('/', requireFields(['business_id', 'name', 'hourly_rate']), staffController.createStaff);

// PATCH /api/staff/:id - Update a staff member
router.patch('/:id', validateUUID('id'), staffController.updateStaff);

// POST /api/staff/:id/clock-in - Clock in a staff member
router.post('/:id/clock-in', validateUUID('id'), staffController.clockIn);

// POST /api/staff/:id/clock-out - Clock out a staff member
router.post('/:id/clock-out', validateUUID('id'), staffController.clockOut);

module.exports = router;