/**
 * Follow-Up Controller
 * Thin HTTP handler — delegates all logic to service.
 */
const followUpService = require('./follow_up.service');

async function list(req, res, next) {
  try {
    const { business_id, type, status, page, limit } = req.query;
    const result = await followUpService.getFollowUps({ business_id, type, status, page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const followUp = await followUpService.getById(req.params.id);
    if (!followUp) return res.status(404).json({ error: 'Follow-up not found' });
    res.json({ success: true, data: followUp });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const followUp = await followUpService.create(req.body);
    res.status(201).json({ success: true, data: followUp });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const followUp = await followUpService.update(req.params.id, req.body);
    res.json({ success: true, data: followUp });
  } catch (err) {
    next(err);
  }
}

async function markSent(req, res, next) {
  try {
    const followUp = await followUpService.markSent(req.params.id);
    res.json({ success: true, data: followUp });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const followUp = await followUpService.cancel(req.params.id);
    res.json({ success: true, data: followUp });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await followUpService.remove(req.params.id);
    res.json({ success: true, message: 'Follow-up deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, show, create, update, markSent, cancel, remove };
