const Stripe = require('stripe');
const prisma = require('../../lib/prisma');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { NotFoundError, ConflictError, ValidationError } = require('../../utils/errors');

const ACTIVE_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'unpaid', 'paused'];

let stripeClient;

function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ValidationError('Stripe secret key is not configured on this server.');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

async function getBusinessOrThrow(businessId) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new NotFoundError('Business');
  return business;
}

function mapSubscriptionRecord(record) {
  if (!record) {
    return {
      has_subscription: false,
      subscription: null,
    };
  }

  return {
    has_subscription: true,
    subscription: {
      id: record.id,
      business_id: record.business_id,
      stripe_customer_id: record.stripe_customer_id,
      stripe_subscription_id: record.stripe_subscription_id,
      stripe_price_id: record.stripe_price_id,
      status: record.status,
      trial_start: record.trial_start,
      trial_end: record.trial_end,
      current_period_start: record.current_period_start,
      current_period_end: record.current_period_end,
      cancel_at_period_end: record.cancel_at_period_end,
      canceled_at: record.canceled_at,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    },
  };
}

function toDateOrNull(value) {
  return value ? new Date(value * 1000) : null;
}

async function findExistingSubscription(businessId) {
  return prisma.businessSubscription.findFirst({
    where: {
      business_id: businessId,
      status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function ensureStripeCustomer(business, input = {}) {
  const stripe = getStripeClient();
  const existingSubscription = await prisma.businessSubscription.findFirst({
    where: {
      business_id: business.id,
      stripe_customer_id: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existingSubscription?.stripe_customer_id) {
    return existingSubscription.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    name: input.customer_name || business.name,
    email: input.customer_email || business.company_email || undefined,
    phone: input.customer_phone || business.company_phone || undefined,
    metadata: {
      business_id: business.id,
      business_name: business.name,
    },
  });

  return customer.id;
}

async function ensureSubscriptionPrice() {
  const stripe = getStripeClient();

  if (env.STRIPE_SUBSCRIPTION_PRICE_ID) {
    return env.STRIPE_SUBSCRIPTION_PRICE_ID;
  }

  if (!Number.isFinite(env.STRIPE_SUBSCRIPTION_PRICE_AMOUNT) || env.STRIPE_SUBSCRIPTION_PRICE_AMOUNT <= 0) {
    throw new ValidationError('Stripe subscription pricing is not configured on this server.');
  }

  const prices = await stripe.prices.list({
    active: true,
    limit: 100,
    expand: ['data.product'],
  });

  const matchingPrice = prices.data.find((price) => {
    const product = price.product;
    return Boolean(
      price.recurring?.interval === 'month'
      && price.currency === env.STRIPE_CURRENCY
      && price.unit_amount === env.STRIPE_SUBSCRIPTION_PRICE_AMOUNT
      && product
      && typeof product !== 'string'
      && product.name === env.STRIPE_SUBSCRIPTION_PRODUCT_NAME
    );
  });

  if (matchingPrice) {
    return matchingPrice.id;
  }

  const product = await stripe.products.create({
    name: env.STRIPE_SUBSCRIPTION_PRODUCT_NAME,
    metadata: {
      source: 'ajicore-backend',
    },
  });

  const price = await stripe.prices.create({
    currency: env.STRIPE_CURRENCY,
    unit_amount: env.STRIPE_SUBSCRIPTION_PRICE_AMOUNT,
    recurring: {
      interval: 'month',
    },
    product: product.id,
  });

  return price.id;
}

async function upsertLocalSubscription(businessId, stripeSubscription, stripeCustomerId, stripePriceId) {
  const data = {
    business_id: businessId,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscription.id,
    stripe_price_id: stripePriceId || stripeSubscription.items?.data?.[0]?.price?.id || null,
    status: stripeSubscription.status,
    trial_start: toDateOrNull(stripeSubscription.trial_start),
    trial_end: toDateOrNull(stripeSubscription.trial_end),
    current_period_start: toDateOrNull(stripeSubscription.current_period_start),
    current_period_end: toDateOrNull(stripeSubscription.current_period_end),
    cancel_at_period_end: Boolean(stripeSubscription.cancel_at_period_end),
    canceled_at: toDateOrNull(stripeSubscription.canceled_at),
  };

  const existing = await prisma.businessSubscription.findFirst({
    where: {
      OR: [
        { stripe_subscription_id: stripeSubscription.id },
        { business_id: businessId, status: { in: ACTIVE_SUBSCRIPTION_STATUSES } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return prisma.businessSubscription.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.businessSubscription.create({ data });
}

async function getStatus(businessId) {
  if (!businessId) throw new ValidationError('business_id is required.');
  const subscription = await prisma.businessSubscription.findFirst({
    where: { business_id: businessId },
    orderBy: { updatedAt: 'desc' },
  });
  return mapSubscriptionRecord(subscription);
}

async function startSubscription(businessId, input = {}) {
  if (!businessId) throw new ValidationError('business_id is required.');

  const business = await getBusinessOrThrow(businessId);
  const existing = await findExistingSubscription(businessId);

  if (existing) {
    return {
      already_active: true,
      ...mapSubscriptionRecord(existing),
    };
  }

  const stripe = getStripeClient();
  const stripeCustomerId = await ensureStripeCustomer(business, input);
  const stripePriceId = await ensureSubscriptionPrice();

  if (input.payment_method_id) {
    await stripe.paymentMethods.attach(input.payment_method_id, {
      customer: stripeCustomerId,
    }).catch(async (err) => {
      if (err.code !== 'resource_already_exists') throw err;
    });

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: input.payment_method_id,
      },
    });
  }

  const stripeSubscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: stripePriceId }],
    trial_period_days: env.STRIPE_SUBSCRIPTION_TRIAL_DAYS,
    payment_behavior: input.payment_method_id ? 'default_incomplete' : undefined,
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      business_id: businessId,
      business_name: business.name,
    },
  });

  const localSubscription = await upsertLocalSubscription(
    businessId,
    stripeSubscription,
    stripeCustomerId,
    stripePriceId
  );

  const clientSecret = stripeSubscription.latest_invoice?.payment_intent?.client_secret || null;

  return {
    already_active: false,
    client_secret: clientSecret,
    ...mapSubscriptionRecord(localSubscription),
  };
}

async function cancelSubscription(businessId) {
  if (!businessId) throw new ValidationError('business_id is required.');

  const subscription = await findExistingSubscription(businessId);
  if (!subscription?.stripe_subscription_id) {
    throw new NotFoundError('Active subscription');
  }

  const stripe = getStripeClient();
  const stripeSubscription = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  const updated = await upsertLocalSubscription(
    businessId,
    stripeSubscription,
    subscription.stripe_customer_id,
    subscription.stripe_price_id
  );

  return mapSubscriptionRecord(updated);
}

async function resumeSubscription(businessId) {
  if (!businessId) throw new ValidationError('business_id is required.');

  const subscription = await findExistingSubscription(businessId);
  if (!subscription?.stripe_subscription_id) {
    throw new NotFoundError('Active subscription');
  }

  if (!subscription.cancel_at_period_end) {
    throw new ConflictError('Subscription is not scheduled for cancellation.');
  }

  const stripe = getStripeClient();
  const stripeSubscription = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: false,
  });

  const updated = await upsertLocalSubscription(
    businessId,
    stripeSubscription,
    subscription.stripe_customer_id,
    subscription.stripe_price_id
  );

  return mapSubscriptionRecord(updated);
}

async function recordStripeEvent(event) {
  const stripeSubscriptionId = event.data?.object?.subscription || event.data?.object?.id || null;
  const stripeCustomerId = event.data?.object?.customer || null;
  const stripeInvoiceId = event.data?.object?.id?.startsWith('in_') ? event.data.object.id : null;
  const stripePaymentIntentId = event.data?.object?.payment_intent
    || (event.data?.object?.id?.startsWith('pi_') ? event.data.object.id : null);

  const subscription = stripeSubscriptionId
    ? await prisma.businessSubscription.findFirst({
        where: { stripe_subscription_id: stripeSubscriptionId },
      })
    : null;

  return prisma.subscriptionPaymentEvent.upsert({
    where: { stripe_event_id: event.id },
    update: {
      business_id: subscription?.business_id || null,
      business_subscription_id: subscription?.id || null,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_invoice_id: stripeInvoiceId,
      stripe_payment_intent_id: stripePaymentIntentId,
      event_type: event.type,
      status: event.data?.object?.status || null,
      payload: sanitizeStripePayload(event),
      occurred_at: event.created ? new Date(event.created * 1000) : null,
    },
    create: {
      business_id: subscription?.business_id || null,
      business_subscription_id: subscription?.id || null,
      stripe_event_id: event.id,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_invoice_id: stripeInvoiceId,
      stripe_payment_intent_id: stripePaymentIntentId,
      event_type: event.type,
      status: event.data?.object?.status || null,
      payload: sanitizeStripePayload(event),
      occurred_at: event.created ? new Date(event.created * 1000) : null,
    },
  });
}

function sanitizeStripePayload(event) {
  if (!event) return null;
  const clone = JSON.parse(JSON.stringify(event));
  if (clone.data?.object?.charges) delete clone.data.object.charges;
  if (clone.data?.object?.payment_method_details) delete clone.data.object.payment_method_details;
  return clone;
}

async function syncSubscriptionFromStripeObject(stripeSubscription) {
  const subscription = await prisma.businessSubscription.findFirst({
    where: { stripe_subscription_id: stripeSubscription.id },
  });

  const businessId = stripeSubscription.metadata?.business_id || subscription?.business_id;
  if (!businessId) {
    logger.warn(`Stripe subscription ${stripeSubscription.id} has no mapped business_id.`);
    return null;
  }

  return upsertLocalSubscription(
    businessId,
    stripeSubscription,
    stripeSubscription.customer,
    stripeSubscription.items?.data?.[0]?.price?.id || null
  );
}

async function handleWebhookEvent(event) {
  await recordStripeEvent(event);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscriptionFromStripeObject(event.data.object);
      break;
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed':
      if (event.data.object.subscription) {
        const stripe = getStripeClient();
        const stripeSubscription = await stripe.subscriptions.retrieve(event.data.object.subscription);
        await syncSubscriptionFromStripeObject(stripeSubscription);
      }
      break;
    case 'checkout.session.completed':
      if (event.data.object.subscription) {
        const stripe = getStripeClient();
        const stripeSubscription = await stripe.subscriptions.retrieve(event.data.object.subscription);
        await syncSubscriptionFromStripeObject(stripeSubscription);
      }
      break;
    case 'payment_intent.succeeded':
      break;
    default:
      break;
  }
}

module.exports = {
  getStatus,
  startSubscription,
  cancelSubscription,
  resumeSubscription,
  handleWebhookEvent,
};
