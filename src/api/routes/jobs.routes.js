/**
 * Jobs Routes
 * CRUD and scheduling endpoints for job management.
 */
const { Router } = require('express');
const jobController = require('../../domains/jobs/job.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireFields, validateUUID } = require('../middlewares/validate.middleware');

const router = Router();

// Apply auth to all job routes
router.use(requireAuth);

// GET /api/jobs - List jobs (filterable by business_id, status)
router.get('/', jobController.getAllJobs);

// GET /api/jobs/schedule - Get schedule view
router.get('/schedule', jobController.getSchedule);

// GET /api/jobs/:id - Get job details
router.get('/:id', validateUUID('id'), jobController.getJobById);

// POST /api/jobs - Create a new job
router.post('/', requireFields(['business_id', 'customer_id']), jobController.createJob);

// PATCH /api/jobs/:id - Update a job
router.patch('/:id', validateUUID('id'), jobController.updateJob);

// DELETE /api/jobs/:id - Delete a job
router.delete('/:id', validateUUID('id'), jobController.deleteJob);

module.exports = router;