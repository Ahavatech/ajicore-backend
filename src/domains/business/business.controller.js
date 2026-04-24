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

async function getFinanceSettings(req, res, next) {
  try {
    const result = await businessService.getFinanceSettings(req.query.business_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updateFinanceSettings(req, res, next) {
  try {
    const result = await businessService.updateFinanceSettings(req.body.business_id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// Canonical RESTful variants used by the Definitive Backend API Blueprint
async function getFinanceSettingsById(req, res, next) {
  try {
    const result = await businessService.getFinanceSettings(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updateFinanceSettingsById(req, res, next) {
  try {
    const result = await businessService.updateFinanceSettings(req.params.id, {
      ...req.body,
      business_id: req.params.id,
    });
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
  getFinanceSettings,
  updateFinanceSettings,
  getFinanceSettingsById,
  updateFinanceSettingsById,
};

