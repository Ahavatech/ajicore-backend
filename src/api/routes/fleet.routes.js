/**
 * Fleet Routes
 * Endpoints for vehicle and fleet management.
 */
const { Router } = require('express');
const vehicleController = require('../../domains/fleet/vehicle.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();

router.use(requireAuth);

// GET /api/fleet - List vehicles
router.get('/', vehicleController.getAllVehicles);

// GET /api/fleet/maintenance-alerts - Get vehicles needing attention
router.get('/maintenance-alerts', vehicleController.getMaintenanceAlerts);

// GET /api/fleet/:id - Get vehicle details
router.get('/:id', validateUUID('id'), vehicleController.getVehicleById);

// POST /api/fleet - Create a new vehicle
router.post('/', requireFields(['business_id', 'make_model']), vehicleController.createVehicle);

// PATCH /api/fleet/:id - Update a vehicle
router.patch('/:id', validateUUID('id'), vehicleController.updateVehicle);

// PATCH /api/fleet/:id/mileage - Update vehicle mileage (triggers maintenance check)
router.patch(
  '/:id/mileage',
  validateUUID('id'),
  requireFields(['mileage']),
  vehicleController.updateMileage
);

module.exports = router;