/**
 * Fleet Routes
 */

/**
 * @swagger
 * tags:
 *   name: Fleet
 *   description: Vehicle and fleet management
 */

const { Router } = require('express');
const vehicleController = require('../../domains/fleet/vehicle.controller');
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/fleet:
 *   get:
 *     summary: Get all vehicles
 *     tags: [Fleet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vehicle list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Vehicle'
 */
router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), vehicleController.getAllVehicles);

/**
 * @swagger
 * /api/fleet/maintenance-alerts:
 *   get:
 *     summary: Get vehicle maintenance alerts
 *     tags: [Fleet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vehicle maintenance alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VehicleMaintenanceAlert'
 */
router.get('/maintenance-alerts', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), vehicleController.getMaintenanceAlerts);

/**
 * @swagger
 * /api/fleet/{id}:
 *   get:
 *     summary: Get a vehicle by ID
 *     tags: [Fleet]
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
 *         description: Vehicle retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 */
router.get('/:id', validateUUID('id'), requireResourceAccess('vehicle'), vehicleController.getVehicleById);

/**
 * @swagger
 * /api/fleet:
 *   post:
 *     summary: Create a new vehicle
 *     tags: [Fleet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VehicleInput'
 *     responses:
 *       201:
 *         description: Vehicle created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 */
router.post('/', requireFields(['business_id', 'make_model']), requireBusinessAccess('body'), vehicleController.createVehicle);

/**
 * @swagger
 * /api/fleet/{id}:
 *   patch:
 *     summary: Update vehicle details
 *     tags: [Fleet]
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
 *             $ref: '#/components/schemas/VehicleUpdateInput'
 *     responses:
 *       200:
 *         description: Vehicle updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 */
router.patch('/:id', validateUUID('id'), requireResourceAccess('vehicle'), vehicleController.updateVehicle);

/**
 * @swagger
 * /api/fleet/{id}/mileage:
 *   patch:
 *     summary: Update vehicle mileage
 *     tags: [Fleet]
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
 *             $ref: '#/components/schemas/VehicleMileageUpdateInput'
 *     responses:
 *       200:
 *         description: Vehicle mileage updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 */
router.patch('/:id/mileage', validateUUID('id'), requireResourceAccess('vehicle'), requireFields(['mileage']), vehicleController.updateMileage);

/**
 * @swagger
 * /api/fleet/{id}:
 *   delete:
 *     summary: Delete a vehicle
 *     tags: [Fleet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vehicle deleted successfully
 */
router.delete('/:id', validateUUID('id'), requireResourceAccess('vehicle'), vehicleController.deleteVehicle);

module.exports = router;
