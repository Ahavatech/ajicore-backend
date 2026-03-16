/**
 * Inventory Routes
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

router.get('/', materialController.getAllMaterials);
router.get('/:id', validateUUID('id'), materialController.getMaterialById);
router.post('/', requireFields(['business_id', 'name']), materialController.createMaterial);
router.patch('/:id', validateUUID('id'), materialController.updateMaterial);
router.post('/:id/restock', validateUUID('id'), requireFields(['quantity']), materialController.restockMaterial);
router.delete('/:id', validateUUID('id'), materialController.removeMaterial);
router.post('/deduct/:jobId', validateUUID('jobId'), requireFields(['materials']), materialController.deductMaterials);

module.exports = router;
