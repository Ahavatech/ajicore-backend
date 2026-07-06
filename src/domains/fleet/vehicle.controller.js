/**
 * Vehicle Controller
 */
const fleetService = require('./fleet.service');

async function getAllVehicles(req, res, next) {
  try {
    const { business_id } = req.query;
    const vehicles = await fleetService.getVehicles(business_id);
    res.json(vehicles);
  } catch (err) { next(err); }
}

async function getVehicleById(req, res, next) {
  try {
    const vehicle = await fleetService.getById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (err) { next(err); }
}

async function createVehicle(req, res, next) {
  try {
    const vehicle = await fleetService.create(req.body);
    res.status(201).json(vehicle);
  } catch (err) { next(err); }
}

async function updateVehicle(req, res, next) {
  try {
    const vehicle = await fleetService.update(req.params.id, req.body);
    res.json(vehicle);
  } catch (err) { next(err); }
}

async function updateMileage(req, res, next) {
  try {
    const result = await fleetService.updateMileage(req.params.id, req.body.mileage);
    res.json(result);
  } catch (err) { next(err); }
}

async function getMaintenanceAlerts(req, res, next) {
  try {
    const { business_id } = req.query;
    const alerts = await fleetService.getMaintenanceAlerts(business_id);
    res.json(alerts);
  } catch (err) { next(err); }
}

async function deleteVehicle(req, res, next) {
  try {
    await fleetService.remove(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

async function logRepair(req, res, next) {
  try {
    const repair = await fleetService.logRepair(req.params.id, req.body, req.user.id);
    res.status(201).json(repair);
  } catch (err) { next(err); }
}

async function getRepairHistory(req, res, next) {
  try {
    const repairs = await fleetService.getRepairHistory(req.params.id);
    res.json(repairs);
  } catch (err) { next(err); }
}

async function getAllRepairs(req, res, next) {
  try {
    const { business_id, vehicle_id, repair_type } = req.query;
    const repairs = await fleetService.getAllRepairs(business_id, { vehicle_id, repair_type });
    res.json(repairs);
  } catch (err) { next(err); }
}

async function getMetrics(req, res, next) {
  try {
    const { business_id } = req.query;
    const metrics = await fleetService.getMetrics(business_id);
    res.json(metrics);
  } catch (err) { next(err); }
}

module.exports = { getAllVehicles, getVehicleById, createVehicle, updateVehicle, updateMileage, getMaintenanceAlerts, deleteVehicle, logRepair, getRepairHistory, getAllRepairs, getMetrics };
