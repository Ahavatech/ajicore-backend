/**
 * Team Check-In Controller
 * Thin HTTP handler — delegates all logic to service.
 */
const checkinService = require('./team_checkin.service');

async function list(req, res, next) {
  try {
    const { business_id, job_id, staff_id, status, start_date, end_date, page, limit } = req.query;
    const result = await checkinService.getCheckins({
      business_id,
      job_id,
      staff_id,
      status,
      start_date,
      end_date,
      page,
      limit,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const checkin = await checkinService.getById(req.params.id);
    if (!checkin) return res.status(404).json({ error: 'Check-in not found' });
    res.json({ success: true, data: checkin });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const checkin = await checkinService.create(req.body);
    res.status(201).json({ success: true, data: checkin });
  } catch (err) {
    next(err);
  }
}

async function receive(req, res, next) {
  try {
    const checkin = await checkinService.receive(req.params.id, req.body.message);
    res.json({ success: true, data: checkin });
  } catch (err) {
    next(err);
  }
}

async function escalate(req, res, next) {
  try {
    const checkin = await checkinService.escalate(req.params.id);
    res.json({ success: true, data: checkin });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const checkin = await checkinService.update(req.params.id, req.body);
    res.json({ success: true, data: checkin });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await checkinService.remove(req.params.id);
    res.json({ success: true, message: 'Check-in deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, show, create, receive, escalate, update, remove };
