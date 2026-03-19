/**
 * Jobs Routes
 * Jobs = confirmed work with known pricing (Scheduled → InProgress → Completed → Invoiced)
 */

/**
 * @swagger
 * tags:
 *   name: Jobs
 *   description: Job management
 */

const { Router } = require('express');
const jobController = require('../../domains/jobs/job.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     summary: Get all jobs
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', jobController.getAllJobs);

/**
 * @swagger
 * /api/jobs/schedule:
 *   get:
 *     summary: Get job schedule
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.get('/schedule', jobController.getSchedule);

/**
 * @swagger
 * /api/jobs/availability:
 *   get:
 *     summary: Check staff/job availability
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.get('/availability', jobController.checkAvailability);

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     summary: Get a job by ID
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id', validateUUID('id'), jobController.getJobById);

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     summary: Create a new job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', requireFields(['business_id', 'customer_id']), jobController.createJob);

/**
 * @swagger
 * /api/jobs/{id}:
 *   patch:
 *     summary: Update a job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id', validateUUID('id'), jobController.updateJob);

/**
 * @swagger
 * /api/jobs/{id}/start:
 *   post:
 *     summary: Start a job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/start', validateUUID('id'), jobController.startJob);

/**
 * @swagger
 * /api/jobs/{id}/complete:
 *   post:
 *     summary: Mark job as completed
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/complete', validateUUID('id'), jobController.completeJob);

/**
 * @swagger
 * /api/jobs/{id}/materials:
 *   post:
 *     summary: Add materials to a job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/materials', validateUUID('id'), requireFields(['materials']), jobController.addMaterials);

/**
 * @swagger
 * /api/jobs/{id}/photos:
 *   post:
 *     summary: Add photos to a job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/photos', validateUUID('id'), requireFields(['photo_urls']), jobController.addPhotos);

/**
 * @swagger
 * /api/jobs/{id}:
 *   delete:
 *     summary: Delete a job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', validateUUID('id'), jobController.deleteJob);

module.exports = router;