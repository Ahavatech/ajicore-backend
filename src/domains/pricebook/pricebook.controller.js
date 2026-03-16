/**
 * Price Book Controller
 */
const pbService = require('./pricebook.service');

// --- Categories ---
async function getCategories(req, res, next) {
  try {
    const { business_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    const data = await pbService.getCategories(business_id);
    res.json(data);
  } catch (err) { next(err); }
}

async function createCategory(req, res, next) {
  try {
    const cat = await pbService.createCategory(req.body);
    res.status(201).json(cat);
  } catch (err) { next(err); }
}

async function updateCategory(req, res, next) {
  try {
    const cat = await pbService.updateCategory(req.params.id, req.body);
    res.json(cat);
  } catch (err) { next(err); }
}

async function deleteCategory(req, res, next) {
  try {
    await pbService.deleteCategory(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

// --- Price Book Items ---
async function getItems(req, res, next) {
  try {
    const { business_id, category_id, search, can_quote_phone, page = 1, limit = 50 } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    const result = await pbService.getPriceBookItems({ business_id, category_id, search, can_quote_phone, page: +page, limit: +limit });
    res.json(result);
  } catch (err) { next(err); }
}

async function getItemById(req, res, next) {
  try {
    const item = await pbService.getPriceBookItemById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Price book item not found' });
    res.json(item);
  } catch (err) { next(err); }
}

async function createItem(req, res, next) {
  try {
    const item = await pbService.createPriceBookItem(req.body);
    res.status(201).json(item);
  } catch (err) { next(err); }
}

async function updateItem(req, res, next) {
  try {
    const item = await pbService.updatePriceBookItem(req.params.id, req.body);
    res.json(item);
  } catch (err) { next(err); }
}

async function deleteItem(req, res, next) {
  try {
    await pbService.deletePriceBookItem(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

async function getSuggestions(req, res, next) {
  try {
    const { business_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    const suggestions = await pbService.getSuggestedItems(business_id);
    res.json(suggestions);
  } catch (err) { next(err); }
}

module.exports = { getCategories, createCategory, updateCategory, deleteCategory, getItems, getItemById, createItem, updateItem, deleteItem, getSuggestions };
