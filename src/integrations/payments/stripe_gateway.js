/**
 * Stripe Payment Gateway Integration
 * Wraps Stripe SDK calls for payment processing.
 */
const env = require('../../config/env');
const logger = require('../../utils/logger');

let stripe = null;

function getStripe() {
  if (!stripe) {
    try {
      const Stripe = require('stripe');
      stripe = new Stripe(env.STRIPE_SECRET_KEY);
    } catch (err) {
      logger.warn('Stripe SDK not installed or STRIPE_SECRET_KEY not set. Payment processing will be manual.');
      return null;
    }
  }
  return stripe;
}

/**
 * Check if Stripe is available and configured.
 */
function isConfigured() {
  if (!env.STRIPE_SECRET_KEY) return false;
  try {
    const client = getStripe();
    return !!client;
  } catch {
    return false;
  }
}

async function createPaymentIntent(params) {
  const client = getStripe();
  if (!client) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }

  const paymentIntent = await client.paymentIntents.create({
    amount: params.amount,
    currency: params.currency || 'usd',
    payment_method: params.payment_method,
    confirm: params.confirm || false,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never',
    },
  });

  logger.info(`Stripe PaymentIntent created: ${paymentIntent.id}`);
  return paymentIntent;
}

async function handleWebhook(payload, signature) {
  const client = getStripe();
  if (!client) throw new Error('Stripe is not configured.');
  const event = client.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  logger.info(`Stripe webhook received: ${event.type}`);
  return event;
}

module.exports = { isConfigured, createPaymentIntent, handleWebhook };
