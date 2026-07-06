/**
 * Material Controller
 */
const materialService = require('./material.service');

async function getAllMaterials(req, res, next) {
  try {
    const { business_id, low_stock, page = 1, limit = 50 } = req.query;
    const result = await materialService.getMaterials({ business_id, lowStock: low_stock === 'true', page: +page, limit: +limit });
    res.json(result);
  } catch (err) { next(err); }
}

async function getMaterialById(req, res, next) {
  try {
    const material = await materialService.getById(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });
    res.json(material);
  } catch (err) { next(err); }
}

async function createMaterial(req, res, next) {
  try {
    const material = await materialService.create(req.body);
    res.status(201).json(material);
  } catch (err) { next(err); }
}

async function updateMaterial(req, res, next) {
  try {
    const material = await materialService.update(req.params.id, req.body);
    res.json(material);
  } catch (err) { next(err); }
}

async function restockMaterial(req, res, next) {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Quantity must be positive' });
    const material = await materialService.restockMaterial(req.params.id, quantity);
    res.json(material);
  } catch (err) { next(err); }
}

async function deductMaterials(req, res, next) {
  try {
    const result = await materialService.deductForJob(req.params.jobId, req.body.materials);
    res.json(result);
  } catch (err) { next(err); }
}

async function removeMaterial(req, res, next) {
  try {
    await materialService.remove(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { getAllMaterials, getMaterialById, createMaterial, updateMaterial, restockMaterial, deductMaterials, removeMaterial };
