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
const { requireAuth, requireBusinessAccess, requireResourceAccess } = require('../middlewares/auth.middleware');
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
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: assigned_staff_id
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: customer_id
 *         schema: { type: string }
 *       - in: query
 *         name: start_date
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: end_date
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Job list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Job'
 */
router.get('/', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), jobController.getAllJobs);

/**
 * @swagger
 * /api/jobs/schedule:
 *   get:
 *     summary: Get job schedule
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: start_date
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: end_date
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Schedule entries retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Job'
 */
router.get('/schedule', requireFields(['business_id'], 'query'), requireBusinessAccess('query'), jobController.getSchedule);

/**
 * @swagger
 * /api/jobs/availability:
 *   get:
 *     summary: Check staff/job availability
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: staff_id
 *         required: true
 *         description: Staff member to check for conflicts
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: start_time
 *         required: true
 *         description: Proposed booking start time in ISO date-time format
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_time
 *         required: true
 *         description: Proposed booking end time in ISO date-time format
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: exclude_job_id
 *         required: false
 *         description: Optional job ID to exclude when editing/rescheduling an existing job
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Availability result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobAvailabilityResponse'
 */
router.get(
  '/availability',
  requireFields(['staff_id', 'start_time', 'end_time'], 'query'),
  requireResourceAccess('staff', { source: 'query', field: 'staff_id', notFoundLabel: 'staff member' }),
  jobController.checkAvailability
);

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
 *           format: uuid
 *     responses:
 *       200:
 *         description: Job retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 */
router.get('/:id', validateUUID('id'), requireResourceAccess('job'), jobController.getJobById);

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     summary: Create a new job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, customer_id]
 *             properties:
 *               business_id: { type: string }
 *               customer_id: { type: string }
 *               assigned_staff_id: { type: string }
 *               title: { type: string }
 *               job_details: { type: string }
 *               service_type: { type: string }
 *               address: { type: string }
 *               scheduled_start_time: { type: string, format: date-time }
  *               scheduled_end_time: { type: string, format: date-time }
 *               service_call_fee: { type: number }
 *               is_emergency: { type: boolean }
 *               status: { type: string }
 *               photo_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *               line_items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     price_book_id: { type: string, format: uuid }
 *                     quantity: { type: number }
 *                     price: { type: number }
 *     responses:
 *       201:
 *         description: Job created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 */
router.post('/', requireFields(['business_id', 'customer_id']), requireBusinessAccess('body'), jobController.createJob);

/**
 * @swagger
 * /api/jobs/{id}:
 *   patch:
 *     summary: Update a job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assigned_staff_id: { type: string }
 *               title: { type: string }
 *               job_details: { type: string }
 *               service_type: { type: string }
 *               address: { type: string }
 *               scheduled_start_time: { type: string, format: date-time }
  *               scheduled_end_time: { type: string, format: date-time }
 *               service_call_fee: { type: number }
 *               is_emergency: { type: boolean }
 *               status: { type: string }
 *               photo_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *               line_items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     price_book_id: { type: string, format: uuid }
 *                     quantity: { type: number }
 *                     price: { type: number }
 *     responses:
 *       200:
 *         description: Job updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 */
router.patch('/:id', validateUUID('id'), requireResourceAccess('job'), jobController.updateJob);

/**
 * @swagger
 * /api/jobs/{id}/start:
 *   post:
 *     summary: Start a job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job started successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 */
router.post('/:id/start', validateUUID('id'), requireResourceAccess('job'), jobController.startJob);

/**
 * @swagger
 * /api/jobs/{id}/complete:
 *   post:
 *     summary: Mark job as completed
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 */
router.post('/:id/complete', validateUUID('id'), requireResourceAccess('job'), jobController.completeJob);

/**
 * @swagger
 * /api/jobs/{id}/materials:
 *   post:
 *     summary: Add materials to a job
 *     tags: [Jobs]
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
 *             $ref: '#/components/schemas/InventoryDeductionInput'
 *     responses:
 *       200:
 *         description: Job materials added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 */
router.post('/:id/materials', validateUUID('id'), requireResourceAccess('job'), requireFields(['materials']), jobController.addMaterials);

/**
 * @swagger
 * /api/jobs/{id}/photos:
 *   post:
 *     summary: Add photos to a job
 *     tags: [Jobs]
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
 *             type: object
 *             required: [photo_urls]
 *             properties:
 *               photo_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *     responses:
 *       200:
 *         description: Job photos added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 */
router.post('/:id/photos', validateUUID('id'), requireResourceAccess('job'), requireFields(['photo_urls']), jobController.addPhotos);

/**
 * @swagger
 * /api/jobs/{id}:
 *   delete:
 *     summary: Delete a job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job deleted successfully
 */
router.delete('/:id', validateUUID('id'), requireResourceAccess('job'), jobController.deleteJob);

module.exports = router;
