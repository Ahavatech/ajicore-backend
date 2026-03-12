/**
 * Stripe Payment Gateway Integration
 * Wraps Stripe SDK calls for payment processing.
 */
const env = require('../../config/env');
const logger = require('../../utils/logger');

// Lazy-load Stripe to avoid crashes if the package isn't installed yet
let stripe = null;

function getStripe() {
  if (!stripe) {
    try {
      const Stripe = require('stripe');
      stripe = new Stripe(env.STRIPE_SECRET_KEY);
    } catch (err) {
      logger.warn('Stripe SDK not installed. Payment features will be unavailable.');
      return null;
    }
  }
  return stripe;
}

/**
 * Create a Stripe PaymentIntent.
 * @param {Object} params - { amount (cents), currency, payment_method, confirm }
 */
async function createPaymentIntent(params) {
  const client = getStripe();
  if (!client) {
    throw new Error('Stripe is not configured. Install stripe package and set STRIPE_SECRET_KEY.');
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

/**
 * Handle Stripe webhook events.
 * @param {string} payload - Raw request body.
 * @param {string} signature - Stripe-Signature header.
 */
async function handleWebhook(payload, signature) {
  const client = getStripe();
  if (!client) throw new Error('Stripe is not configured.');

  const event = client.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  logger.info(`Stripe webhook received: ${event.type}`);
  return event;
}

module.exports = { createPaymentIntent, handleWebhook };