const stripeGateway = require('../../integrations/payments/stripe_gateway');
const subscriptionService = require('../subscriptions/subscription.service');
const logger = require('../../utils/logger');

async function handleStripeWebhook(req, res, next) {
  try {
    const signature = req.headers['stripe-signature'];
    const event = await stripeGateway.handleWebhook(req.body, signature);
    logger.info(`Stripe webhook processed: ${event.type}`);
    await subscriptionService.handleWebhookEvent(event);
    res.json({ received: true, event_type: event.type });
  } catch (err) {
    if (err?.type === 'StripeSignatureVerificationError') {
      err.statusCode = 400;
      err.name = 'ValidationError';
    }
    next(err);
  }
}

module.exports = {
  handleStripeWebhook,
};
