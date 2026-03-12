/**
 * Inventory Routes
 * Endpoints for material/inventory management.
 */
const { Router } = require('express');
const materialController = require('../../domains/inventory/material.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();

router.use(requireAuth);

// GET /api/inventory - List materials (filterable by business_id, low_stock)
router.get('/', materialController.getAllMaterials);

// GET /api/inventory/:id - Get material details
router.get('/:id', validateUUID('id'), materialController.getMaterialById);

// POST /api/inventory - Create a new material
router.post('/', requireFields(['business_id', 'name']), materialController.createMaterial);

// PATCH /api/inventory/:id - Update a material
router.patch('/:id', validateUUID('id'), materialController.updateMaterial);

// POST /api/inventory/deduct/:jobId - Deduct materials for a completed job
router.post(
  '/deduct/:jobId',
  validateUUID('jobId'),
  requireFields(['materials']),
  materialController.deductMaterials
);

module.exports = router;