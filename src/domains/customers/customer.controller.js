/**
 * Customer Controller
 */
const customerService = require('./customer.service');

async function getAll(req, res, next) {
  try {
    const { business_id, search, page = 1, limit = 20 } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    const result = await customerService.getCustomers({ business_id, search, page: +page, limit: +limit });
    res.json(result);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const customer = await customerService.getById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) { next(err); }
}

async function findByPhone(req, res, next) {
  try {
    const { business_id, phone } = req.query;
    if (!business_id || !phone) return res.status(400).json({ error: 'business_id and phone are required' });
    const customer = await customerService.findByPhone(business_id, phone);
    res.json(customer || null);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const customer = await customerService.create(req.body);
    res.status(201).json(customer);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const customer = await customerService.update(req.params.id, req.body);
    res.json(customer);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await customerService.remove(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

async function getHistory(req, res, next) {
  try {
    const history = await customerService.getCustomerJobHistory(req.params.id);
    res.json(history);
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, findByPhone, create, update, remove, getHistory };
