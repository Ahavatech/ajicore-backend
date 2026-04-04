/**
 * Quote Controller
 */
const quoteService = require('./quote.service');

async function getAll(req, res, next) {
  try {
    const {
      business_id,
      status,
      customer_id,
      assigned_staff_id,
      start_date,
      end_date,
      search,
      page = 1,
      limit = 20,
    } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    const result = await quoteService.getQuotes({
      business_id,
      status,
      customer_id,
      assigned_staff_id,
      start_date,
      end_date,
      search,
      page: +page,
      limit: +limit,
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const quote = await quoteService.getById(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    res.json(quote);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const quote = await quoteService.create(req.body);
    res.status(201).json(quote);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const quote = await quoteService.update(req.params.id, req.body);
    res.json(quote);
  } catch (err) { next(err); }
}

async function sendQuote(req, res, next) {
  try {
    const quote = await quoteService.sendQuote(req.params.id);
    res.json(quote);
  } catch (err) { next(err); }
}

async function approve(req, res, next) {
  try {
    const result = await quoteService.approveAndConvert(req.params.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
}

async function decline(req, res, next) {
  try {
    const quote = await quoteService.declineQuote(req.params.id, req.body.reason);
    res.json(quote);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await quoteService.deleteQuote(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, sendQuote, approve, decline, remove };
