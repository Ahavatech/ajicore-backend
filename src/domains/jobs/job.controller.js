/**
 * Job Controller
 * Handles HTTP request/response logic for job management.
 */
const jobService = require('./job.service');
const scheduleService = require('./schedule.service');

async function getAllJobs(req, res, next) {
  try {
    const {
      business_id,
      status,
      type,
      customer_id,
      assigned_staff_id,
      start_date,
      end_date,
      search,
      page = 1,
      limit = 20,
    } = req.query;
    const jobs = await jobService.getJobs({
      business_id,
      status,
      type,
      customer_id,
      assigned_staff_id,
      start_date,
      end_date,
      search,
      page: +page,
      limit: +limit,
    });
    res.json(jobs);
  } catch (err) { next(err); }
}

async function getJobById(req, res, next) {
  try {
    const job = await jobService.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) { next(err); }
}

async function createJob(req, res, next) {
  try {
    const job = await jobService.createJob(req.body);
    res.status(201).json(job);
  } catch (err) { next(err); }
}

async function updateJob(req, res, next) {
  try {
    const job = await jobService.updateJob(req.params.id, req.body);
    res.json(job);
  } catch (err) { next(err); }
}

async function startJob(req, res, next) {
  try {
    const job = await jobService.startJob(req.params.id);
    res.json(job);
  } catch (err) { next(err); }
}

async function completeJob(req, res, next) {
  try {
    const job = await jobService.completeJob(req.params.id);
    res.json(job);
  } catch (err) { next(err); }
}

async function addMaterials(req, res, next) {
  try {
    const result = await jobService.addMaterials(req.params.id, req.body.materials);
    res.json(result);
  } catch (err) { next(err); }
}

async function addPhotos(req, res, next) {
  try {
    const job = await jobService.addPhotos(req.params.id, req.body.photo_urls);
    res.json(job);
  } catch (err) { next(err); }
}

async function deleteJob(req, res, next) {
  try {
    await jobService.deleteJob(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

async function getSchedule(req, res, next) {
  try {
    const { business_id, start_date, end_date } = req.query;
    const schedule = await scheduleService.getSchedule(business_id, start_date, end_date);
    res.json(schedule);
  } catch (err) { next(err); }
}

async function checkAvailability(req, res, next) {
  try {
    const { staff_id, start_time, end_time, exclude_job_id } = req.query;
    const result = await scheduleService.checkStaffAvailability(staff_id, start_time, end_time, {
      exclude_job_id,
    });
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { getAllJobs, getJobById, createJob, updateJob, startJob, completeJob, addMaterials, addPhotos, deleteJob, getSchedule, checkAvailability };
