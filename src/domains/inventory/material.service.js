/**
 * Material Service
 * Business logic for inventory tracking, stock deduction, and low-stock alerts.
 */
const prisma = require('../../lib/prisma');
const logger = require('../../utils/logger');

async function getMaterials({ business_id, lowStock = false, page = 1, limit = 50 }) {
  const where = {};
  if (business_id) where.business_id = business_id;
  if (lowStock) where.quantity_on_hand = { lte: prisma.material.fields.restock_threshold };

  const skip = (page - 1) * limit;

  let materials;
  if (lowStock) {
    const all = await prisma.material.findMany({ where: { business_id }, orderBy: { name: 'asc' } });
    materials = all.filter((m) => m.quantity_on_hand <= m.restock_threshold);
    return { data: materials, total: materials.length, page: 1, limit: materials.length };
  }

  const [data, total] = await Promise.all([
    prisma.material.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.material.count({ where }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getById(id) {
  return prisma.material.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.material.create({
    data: {
      business_id: data.business_id,
      name: data.name,
      unit: data.unit || null,
      quantity_on_hand: data.quantity_on_hand || 0,
      restock_threshold: data.restock_threshold || 5,
      unit_cost: data.unit_cost || null,
    },
  });
}

async function update(id, data) {
  const updateData = {};
  const fields = ['name', 'unit', 'quantity_on_hand', 'restock_threshold', 'unit_cost'];
  fields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
  return prisma.material.update({ where: { id }, data: updateData });
}

async function restockMaterial(id, quantity) {
  return prisma.material.update({
    where: { id },
    data: { quantity_on_hand: { increment: quantity } },
  });
}

async function deductForJob(jobId, materials) {
  const results = [];
  for (const item of materials) {
    const material = await prisma.material.findUnique({ where: { id: item.material_id } });
    if (!material) { results.push({ material_id: item.material_id, error: 'Not found' }); continue; }

    const newQty = Math.max(material.quantity_on_hand - item.quantity, 0);
    const updated = await prisma.material.update({ where: { id: item.material_id }, data: { quantity_on_hand: newQty } });

    await prisma.jobMaterial.create({
      data: { job_id: jobId, material_id: item.material_id, quantity_used: item.quantity, unit_cost: material.unit_cost },
    });

    if (updated.quantity_on_hand <= updated.restock_threshold) {
      logger.warn(`Low stock: ${updated.name} (${updated.quantity_on_hand} remaining)`);
    }

    results.push({ material_id: item.material_id, name: updated.name, new_quantity: updated.quantity_on_hand });
  }
  return results;
}

async function remove(id) {
  return prisma.material.delete({ where: { id } });
}

module.exports = { getMaterials, getById, create, update, restockMaterial, deductForJob, remove };
