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
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
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
router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), materialController.getAllMaterials);

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
router.get('/:id', validateUUID('id'), requireResourceAccess('material'), materialController.getMaterialById);

/**
 * @swagger
 * /api/inventory:
 *   post:
 *     summary: Create a new material
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', requireFields(['business_id', 'name']), requireBusinessAccess('body'), materialController.createMaterial);

/**
 * @swagger
 * /api/inventory/{id}:
 *   patch:
 *     summary: Update material details
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id', validateUUID('id'), requireResourceAccess('material'), materialController.updateMaterial);

/**
 * @swagger
 * /api/inventory/{id}/restock:
 *   post:
 *     summary: Restock material quantity
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/restock', validateUUID('id'), requireResourceAccess('material'), requireFields(['quantity']), materialController.restockMaterial);

/**
 * @swagger
 * /api/inventory/{id}:
 *   delete:
 *     summary: Delete a material
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', validateUUID('id'), requireResourceAccess('material'), materialController.removeMaterial);

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
router.post('/deduct/:jobId', validateUUID('jobId'), requireResourceAccess('job', { field: 'jobId' }), requireFields(['materials']), materialController.deductMaterials);

module.exports = router;
