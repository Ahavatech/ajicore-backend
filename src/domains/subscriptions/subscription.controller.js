const subscriptionService = require('./subscription.service');

async function getStatus(req, res, next) {
  try {
    const result = await subscriptionService.getStatus(req.query.business_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function start(req, res, next) {
  try {
    const result = await subscriptionService.startSubscription(req.body.business_id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const result = await subscriptionService.cancelSubscription(req.body.business_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function resume(req, res, next) {
  try {
    const result = await subscriptionService.resumeSubscription(req.body.business_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStatus,
  start,
  cancel,
  resume,
};
