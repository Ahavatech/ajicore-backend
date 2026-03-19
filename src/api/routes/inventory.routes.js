/**
 * Inventory Routes
 */

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Materials and inventory management
 */

const { Router } = require('express');
const materialController = require('../../domains/inventory/material.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/inventory:
 *   get:
 *     summary: Get all materials
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', materialController.getAllMaterials);

/**
 * @swagger
 * /api/inventory/{id}:
 *   get:
 *     summary: Get material by ID
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id', validateUUID('id'), materialController.getMaterialById);

/**
 * @swagger
 * /api/inventory:
 *   post:
 *     summary: Create a new material
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', requireFields(['business_id', 'name']), materialController.createMaterial);

/**
 * @swagger
 * /api/inventory/{id}:
 *   patch:
 *     summary: Update material details
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id', validateUUID('id'), materialController.updateMaterial);

/**
 * @swagger
 * /api/inventory/{id}/restock:
 *   post:
 *     summary: Restock material quantity
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/restock', validateUUID('id'), requireFields(['quantity']), materialController.restockMaterial);

/**
 * @swagger
 * /api/inventory/{id}:
 *   delete:
 *     summary: Delete a material
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', validateUUID('id'), materialController.removeMaterial);

/**
 * @swagger
 * /api/inventory/deduct/{jobId}:
 *   post:
 *     summary: Deduct materials based on job usage
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 */
router.post('/deduct/:jobId', validateUUID('jobId'), requireFields(['materials']), materialController.deductMaterials);

module.exports = router;