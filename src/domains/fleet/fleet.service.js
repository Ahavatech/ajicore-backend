/**
 * Fleet Service
 * Business logic for vehicle management, mileage tracking, and maintenance alerts.
 */
const prisma = require('../../lib/prisma');
const logger = require('../../utils/logger');
const { NotFoundError } = require('../../utils/errors');

async function getVehicles(businessId) {
  const where = {};
  if (businessId) where.business_id = businessId;
  return prisma.vehicle.findMany({ where, orderBy: { make_model: 'asc' } });
}

async function getById(id) {
  return prisma.vehicle.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.vehicle.create({
    data: {
      business_id: data.business_id,
      make_model: data.make_model,
      year: data.year || null,
      license_plate: data.license_plate || null,
      mileage: data.mileage || 0,
      insurance_expiry: data.insurance_expiry ? new Date(data.insurance_expiry) : null,
      registration_renewal: data.registration_renewal ? new Date(data.registration_renewal) : null,
      maintenance_cycle_miles: data.maintenance_cycle_miles || 5000,
      last_maintenance_mileage: data.last_maintenance_mileage || 0,
      notes: data.notes || null,
    },
  });
}

async function update(id, data) {
  const updateData = {};
  const fields = ['make_model', 'year', 'license_plate', 'maintenance_cycle_miles', 'last_maintenance_mileage', 'notes'];
  fields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
  if (data.insurance_expiry) updateData.insurance_expiry = new Date(data.insurance_expiry);
  if (data.registration_renewal) updateData.registration_renewal = new Date(data.registration_renewal);
  return prisma.vehicle.update({ where: { id }, data: updateData });
}

async function updateMileage(id, newMileage) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw new NotFoundError('Vehicle not found.');

  const updated = await prisma.vehicle.update({ where: { id }, data: { mileage: newMileage } });
  const milesSinceMaintenance = newMileage - vehicle.last_maintenance_mileage;
  const maintenanceDue = milesSinceMaintenance >= vehicle.maintenance_cycle_miles;

  if (maintenanceDue) {
    logger.warn(`Maintenance due for ${vehicle.make_model} (${milesSinceMaintenance} miles since last service)`);
  }

  return {
    vehicle: updated,
    maintenance_due: maintenanceDue,
    miles_since_maintenance: milesSinceMaintenance,
    miles_until_maintenance: maintenanceDue ? 0 : vehicle.maintenance_cycle_miles - milesSinceMaintenance,
  };
}

async function getMaintenanceAlerts(businessId) {
  const vehicles = await prisma.vehicle.findMany({ where: { business_id: businessId } });
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return vehicles.map((v) => {
    const alerts = [];
    const milesSinceMaintenance = v.mileage - v.last_maintenance_mileage;
    if (milesSinceMaintenance >= v.maintenance_cycle_miles) {
      alerts.push({ type: 'maintenance_due', message: `${milesSinceMaintenance} miles since last service` });
    }
    if (v.insurance_expiry && v.insurance_expiry <= thirtyDays) {
      alerts.push({ type: 'insurance_expiring', message: `Insurance expires ${v.insurance_expiry.toISOString().split('T')[0]}` });
    }
    if (v.registration_renewal && v.registration_renewal <= thirtyDays) {
      alerts.push({ type: 'registration_expiring', message: `Registration expires ${v.registration_renewal.toISOString().split('T')[0]}` });
    }
    return alerts.length > 0 ? { vehicle: v, alerts } : null;
  }).filter(Boolean);
}

async function remove(id) {
  return prisma.vehicle.delete({ where: { id } });
}

async function logRepair(vehicleId, data, userId) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new NotFoundError('Vehicle not found.');

  return prisma.fleetRepair.create({
    data: {
      vehicle_id: vehicleId,
      business_id: vehicle.business_id,
      repair_type: data.repair_type,
      description: data.description,
      cost: data.cost || null,
      completion_date: new Date(data.completion_date),
      miles_at_service: data.miles_at_service || null,
      notes: data.notes || null,
      created_by: userId,
    },
  });
}

async function getRepairHistory(vehicleId) {
  return prisma.fleetRepair.findMany({
    where: { vehicle_id: vehicleId },
    orderBy: { completion_date: 'desc' },
  });
}

async function getAllRepairs(businessId, filters = {}) {
  const where = { business_id: businessId };
  if (filters.vehicle_id) where.vehicle_id = filters.vehicle_id;
  if (filters.repair_type) where.repair_type = filters.repair_type;

  return prisma.fleetRepair.findMany({
    where,
    include: { vehicle: { select: { id: true, make_model: true } } },
    orderBy: { completion_date: 'desc' },
  });
}

module.exports = { getVehicles, getById, create, update, updateMileage, getMaintenanceAlerts, remove, logRepair, getRepairHistory, getAllRepairs };
