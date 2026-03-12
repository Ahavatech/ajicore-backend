/**
 * Material Service
 * Business logic for inventory tracking, stock deduction, and low-stock alerts.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');

async function getMaterials({ business_id, lowStock = false }) {
  const where = {};
  if (business_id) where.business_id = business_id;

  const materials = await prisma.material.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  if (lowStock) {
    return materials.filter((m) => m.quantity_on_hand <= m.restock_threshold);
  }

  return materials;
}

async function getById(id) {
  return prisma.material.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.material.create({
    data: {
      business_id: data.business_id,
      name: data.name,
      quantity_on_hand: data.quantity_on_hand || 0,
      restock_threshold: data.restock_threshold || 5,
      unit_cost: data.unit_cost || null,
    },
  });
}

async function update(id, data) {
  const updateData = {};
  if (data.name) updateData.name = data.name;
  if (data.quantity_on_hand !== undefined) updateData.quantity_on_hand = data.quantity_on_hand;
  if (data.restock_threshold !== undefined) updateData.restock_threshold = data.restock_threshold;
  if (data.unit_cost !== undefined) updateData.unit_cost = data.unit_cost;

  return prisma.material.update({ where: { id }, data: updateData });
}

/**
 * Deduct materials when a job is completed.
 * Also creates Job_Material records for tracking.
 * @param {string} jobId
 * @param {Array<{material_id: string, quantity: number}>} materials
 */
async function deductForJob(jobId, materials) {
  const results = [];

  for (const item of materials) {
    const material = await prisma.material.findUnique({ where: { id: item.material_id } });

    if (!material) {
      results.push({ material_id: item.material_id, error: 'Material not found' });
      continue;
    }

    const newQuantity = material.quantity_on_hand - item.quantity;

    // Update stock
    const updated = await prisma.material.update({
      where: { id: item.material_id },
      data: { quantity_on_hand: Math.max(newQuantity, 0) },
    });

    // Create Job_Material record
    await prisma.job_Material.create({
      data: {
        job_id: jobId,
        material_id: item.material_id,
        quantity_used: item.quantity,
      },
    });

    // Check for low stock alert
    if (updated.quantity_on_hand <= updated.restock_threshold) {
      logger.warn(`Low stock alert: ${updated.name} (${updated.quantity_on_hand} remaining)`);
    }

    results.push({ material_id: item.material_id, name: updated.name, new_quantity: updated.quantity_on_hand });
  }

  return results;
}

module.exports = { getMaterials, getById, create, update, deductForJob };