/**
 * Fleet Routes
 * @swagger
 * tags:
 *   name: Fleet
 *   description: Vehicle and fleet management
 */
const { Router } = require('express');
const vehicleController = require('../../domains/fleet/vehicle.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

router.get('/', vehicleController.getAllVehicles);
router.get('/maintenance-alerts', vehicleController.getMaintenanceAlerts);
router.get('/:id', validateUUID('id'), vehicleController.getVehicleById);
router.post('/', requireFields(['business_id', 'make_model']), vehicleController.createVehicle);
router.patch('/:id', validateUUID('id'), vehicleController.updateVehicle);
router.patch('/:id/mileage', validateUUID('id'), requireFields(['mileage']), vehicleController.updateMileage);
router.delete('/:id', validateUUID('id'), vehicleController.deleteVehicle);

module.exports = router;
