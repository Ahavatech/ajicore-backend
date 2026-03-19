/**
 * Categorization Rule Controller
 * Thin HTTP handler — delegates all logic to service.
 */
const ruleService = require('./categorization_rule.service');

async function list(req, res, next) {
  try {
    const { business_id } = req.query;
    const data = await ruleService.getRules(business_id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const rule = await ruleService.getById(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const rule = await ruleService.create(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const rule = await ruleService.update(req.params.id, req.body);
    res.json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await ruleService.remove(req.params.id);
    res.json({ success: true, message: 'Rule deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, show, create, update, remove };
