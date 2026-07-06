/**
 * Search Routes
 */

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Global search and omnibar
 */

const { Router } = require('express');
const searchController = require('../../domains/search/search.controller');
const { requireAuth, requireBusinessAccess } = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Global search across all entities
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5 }
 *         description: Max results per category
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: object
 *                   properties:
 *                     customers:
 *                       type: array
 *                     jobs:
 *                       type: array
 *                     invoices:
 *                       type: array
 *                     quotes:
 *                       type: array
 *                     fleet:
 *                       type: array
 */
router.get('/', requireFields(['business_id', 'q'], 'query'), requireBusinessAccess('query'), searchController.globalSearch);

module.exports = router;
