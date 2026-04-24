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

module.exports = {
  getStripeConnectUrl,
};
