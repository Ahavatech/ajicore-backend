/**
 * Fleet Service
 * Business logic for vehicle management, mileage tracking, and maintenance alerts.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');

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

module.exports = { getVehicles, getById, create, update, updateMileage, getMaintenanceAlerts, remove };
