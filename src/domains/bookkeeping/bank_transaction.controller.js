/**
 * Bank Transaction Controller
 * Thin HTTP handler — delegates all logic to service.
 */
const txService = require('./bank_transaction.service');

async function list(req, res, next) {
  try {
    const { business_id, is_income, category, page, limit } = req.query;
    const result = await txService.getTransactions({ business_id, is_income, category, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const tx = await txService.getById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const tx = await txService.create(req.body);
    res.status(201).json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
}

async function bulkCreate(req, res, next) {
  try {
    const result = await txService.bulkCreate(req.body.business_id, req.body.transactions);
    res.status(201).json({ success: true, count: result.count });
  } catch (err) {
    next(err);
  }
}

async function categorize(req, res, next) {
  try {
    const tx = await txService.categorize(req.params.id, req.body.category, req.body.confidence);
    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const tx = await txService.update(req.params.id, req.body);
    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await txService.remove(req.params.id);
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    const { business_id } = req.query;
    const data = await txService.getSummary(business_id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, show, create, bulkCreate, categorize, update, remove, summary };
