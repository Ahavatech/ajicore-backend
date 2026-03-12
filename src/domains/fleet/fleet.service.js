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
      license_plate: data.license_plate || null,
      mileage: data.mileage || 0,
      insurance_expiry: data.insurance_expiry ? new Date(data.insurance_expiry) : null,
      registration_renewal: data.registration_renewal ? new Date(data.registration_renewal) : null,
      maintenance_cycle_miles: data.maintenance_cycle_miles || 5000,
      last_maintenance_mileage: data.last_maintenance_mileage || 0,
    },
  });
}

async function update(id, data) {
  const updateData = {};
  if (data.make_model) updateData.make_model = data.make_model;
  if (data.license_plate !== undefined) updateData.license_plate = data.license_plate;
  if (data.insurance_expiry) updateData.insurance_expiry = new Date(data.insurance_expiry);
  if (data.registration_renewal) updateData.registration_renewal = new Date(data.registration_renewal);
  if (data.maintenance_cycle_miles !== undefined) updateData.maintenance_cycle_miles = data.maintenance_cycle_miles;

  return prisma.vehicle.update({ where: { id }, data: updateData });
}

/**
 * Update vehicle mileage and check if maintenance is due.
 */
async function updateMileage(id, newMileage) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }

  const updated = await prisma.vehicle.update({
    where: { id },
    data: { mileage: newMileage },
  });

  const milesSinceLastMaintenance = newMileage - vehicle.last_maintenance_mileage;
  const maintenanceDue = milesSinceLastMaintenance >= vehicle.maintenance_cycle_miles;

  if (maintenanceDue) {
    logger.warn(`Maintenance due for vehicle ${vehicle.make_model} (${milesSinceLastMaintenance} miles since last service)`);
  }

  return {
    vehicle: updated,
    maintenance_due: maintenanceDue,
    miles_since_maintenance: milesSinceLastMaintenance,
    miles_until_maintenance: maintenanceDue ? 0 : vehicle.maintenance_cycle_miles - milesSinceLastMaintenance,
  };
}

/**
 * Get all vehicles that need maintenance or have expiring documents.
 */
async function getMaintenanceAlerts(businessId) {
  const vehicles = await prisma.vehicle.findMany({
    where: { business_id: businessId },
  });

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return vehicles
    .map((v) => {
      const alerts = [];
      const milesSinceMaintenance = v.mileage - v.last_maintenance_mileage;

      if (milesSinceMaintenance >= v.maintenance_cycle_miles) {
        alerts.push({ type: 'maintenance_due', message: `${milesSinceMaintenance} miles since last service` });
      }
      if (v.insurance_expiry && v.insurance_expiry <= thirtyDaysFromNow) {
        alerts.push({ type: 'insurance_expiring', message: `Insurance expires ${v.insurance_expiry.toISOString().split('T')[0]}` });
      }
      if (v.registration_renewal && v.registration_renewal <= thirtyDaysFromNow) {
        alerts.push({ type: 'registration_expiring', message: `Registration expires ${v.registration_renewal.toISOString().split('T')[0]}` });
      }

      return alerts.length > 0 ? { vehicle: v, alerts } : null;
    })
    .filter(Boolean);
}

module.exports = { getVehicles, getById, create, update, updateMileage, getMaintenanceAlerts };