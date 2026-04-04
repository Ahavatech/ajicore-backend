const businessService = require('./business.service');

async function getProfile(req, res, next) {
  try {
    const result = await businessService.getProfile(req.query.business_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const result = await businessService.updateProfile(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getAlerts(req, res, next) {
  try {
    const result = await businessService.getAlerts(req.query.business_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updateAlerts(req, res, next) {
  try {
    const result = await businessService.updateAlerts(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getAutomation(req, res, next) {
  try {
    const result = await businessService.getAutomation(req.query.business_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updateAutomation(req, res, next) {
  try {
    const result = await businessService.updateAutomation(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getCommunication(req, res, next) {
  try {
    const result = await businessService.getCommunication(req.query.business_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updateCommunication(req, res, next) {
  try {
    const result = await businessService.updateCommunication(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getAlerts,
  updateAlerts,
  getAutomation,
  updateAutomation,
  getCommunication,
  updateCommunication,
};
