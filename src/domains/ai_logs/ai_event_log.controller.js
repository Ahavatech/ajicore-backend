/**
 * AI Event Log Controller
 * Thin HTTP handler — delegates all logic to service.
 */
const logService = require('./ai_event_log.service');

async function list(req, res, next) {
  try {
    const { business_id, event_type, job_id, customer_id, page, limit } = req.query;
    const result = await logService.getLogs({ business_id, event_type, job_id, customer_id, page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const entry = await logService.getById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Log entry not found' });
    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const entry = await logService.log(req.body);
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
}

async function eventTypes(req, res, next) {
  try {
    const { business_id } = req.query;
    const data = await logService.getEventTypes(business_id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, show, create, eventTypes };
