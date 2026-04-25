/**
 * Integrations Controller
 * HTTP handlers for third-party integrations
 */

const integrationsService = require('./integrations.service');

async function getStripeConnectUrl(req, res, next) {
  try {
    const result = await integrationsService.getStripeConnectUrl(req.query.business_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getPlaidLinkToken(req, res, next) {
  try {
    const result = await integrationsService.createPlaidLinkToken(req.query.business_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function syncQuickBooks(req, res, next) {
  try {
    const result = await integrationsService.syncQuickBooks(req.body.business_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStripeConnectUrl,
  getPlaidLinkToken,
  syncQuickBooks,
};
