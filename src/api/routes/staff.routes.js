/**
 * Staff Routes
 * @swagger
 * tags:
 *   name: Staff
 *   description: Staff management, timesheets, and payroll
 */
const { Router } = require('express');
const staffController = require('../../domains/team/staff.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

router.get('/', staffController.getAllStaff);
router.get('/payroll', staffController.calculatePayroll);
router.get('/timesheets', staffController.getTimesheets);
router.get('/:id', validateUUID('id'), staffController.getStaffById);
router.post('/', requireFields(['business_id', 'name', 'hourly_rate']), staffController.createStaff);
router.patch('/:id', validateUUID('id'), staffController.updateStaff);
router.delete('/:id', validateUUID('id'), staffController.deleteStaff);
router.post('/:id/clock-in', validateUUID('id'), staffController.clockIn);
router.post('/:id/clock-out', validateUUID('id'), staffController.clockOut);

module.exports = router;
