/**
 * Jobs Routes
 * Jobs = confirmed work with known pricing (Scheduled → InProgress → Completed → Invoiced)
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

router.get('/', jobController.getAllJobs);
router.get('/schedule', jobController.getSchedule);
router.get('/availability', jobController.checkAvailability);
router.get('/:id', validateUUID('id'), jobController.getJobById);
router.post('/', requireFields(['business_id', 'customer_id']), jobController.createJob);
router.patch('/:id', validateUUID('id'), jobController.updateJob);
router.post('/:id/start', validateUUID('id'), jobController.startJob);
router.post('/:id/complete', validateUUID('id'), jobController.completeJob);
router.post('/:id/materials', validateUUID('id'), requireFields(['materials']), jobController.addMaterials);
router.post('/:id/photos', validateUUID('id'), requireFields(['photo_urls']), jobController.addPhotos);
router.delete('/:id', validateUUID('id'), jobController.deleteJob);

module.exports = router;
