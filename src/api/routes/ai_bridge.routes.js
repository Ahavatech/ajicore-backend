/**
 * AI Bridge Routes
 * Internal API endpoints for the AI service to query and mutate business data.
 * Protected by internal API key authentication.
 */
const { Router } = require('express');
const { requireInternalApiKey } = require('../middlewares/auth.middleware');
const jobController = require('../../domains/jobs/job.controller');
const materialController = require('../../domains/inventory/material.controller');
const smsController = require('../../domains/communications/sms.controller');

const router = Router();

// All AI Bridge routes require internal API key
router.use(requireInternalApiKey);

// --- Schedule & Jobs ---
// GET /api/internal/schedule - AI queries upcoming schedule
router.get('/schedule', jobController.getSchedule);

// GET /api/internal/jobs - AI queries jobs
router.get('/jobs', jobController.getAllJobs);

// POST /api/internal/jobs - AI creates a new job
router.post('/jobs', jobController.createJob);

// PATCH /api/internal/jobs/:id - AI updates a job (e.g., status change)
router.patch('/jobs/:id', jobController.updateJob);

// --- Inventory ---
// GET /api/internal/inventory - AI queries material levels
router.get('/inventory', materialController.getAllMaterials);

// --- SMS ---
// POST /api/internal/sms/incoming - Twilio webhook for incoming SMS
router.post('/sms/incoming', smsController.handleIncomingSms);

// POST /api/internal/sms/send - AI sends an outbound SMS
router.post('/sms/send', smsController.sendSms);

module.exports = router;