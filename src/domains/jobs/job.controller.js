/**
 * Job Controller
 * Handles HTTP request/response logic for job management.
 */
const jobService = require('./job.service');
const scheduleService = require('./schedule.service');

async function getAllJobs(req, res, next) {
  try {
    const { business_id, status, page = 1, limit = 20 } = req.query;
    const jobs = await jobService.getJobs({ business_id, status, page: +page, limit: +limit });
    res.json(jobs);
  } catch (err) {
    next(err);
  }
}

async function getJobById(req, res, next) {
  try {
    const job = await jobService.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    next(err);
  }
}

async function createJob(req, res, next) {
  try {
    const job = await jobService.createJob(req.body);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
}

async function updateJob(req, res, next) {
  try {
    const job = await jobService.updateJob(req.params.id, req.body);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

async function deleteJob(req, res, next) {
  try {
    await jobService.deleteJob(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function getSchedule(req, res, next) {
  try {
    const { business_id, start_date, end_date } = req.query;
    const schedule = await scheduleService.getSchedule(business_id, start_date, end_date);
    res.json(schedule);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllJobs, getJobById, createJob, updateJob, deleteJob, getSchedule };