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
    try {
      // Lazy-load Stripe so a bad dependency install does not take down the whole API at boot.
      const Stripe = require('stripe');
      stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
    } catch (err) {
      logger.error(`Stripe SDK load failed: ${err.code || 'UNKNOWN'} ${err.message}`, {
        stack: err.stack,
      });
      throw new ValidationError(`Stripe SDK load failed: ${err.code || err.message}`);
    }
  }

  return stripeClient;
}

async function getBusinessOrThrow(businessId) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      owner: true,
    },
  });
  if (!business) throw new NotFoundError('Business');
  return business;
}

function mapPaymentMethodSummary(paymentMethod) {
  if (!paymentMethod?.card) {
    return null;
  }

  return {
    id: paymentMethod.id,
    brand: paymentMethod.card.brand,
    last4: paymentMethod.card.last4,
    exp_month: paymentMethod.card.exp_month,
    exp_year: paymentMethod.card.exp_year,
  };
}

function mapSubscriptionRecord(record, extras = {}) {
  if (!record) {
    return {
      has_subscription: false,
      subscription: null,
      payment_method_ready: false,
      default_payment_method: null,
      ...extras,
    };
  }

  return {
    has_subscription: true,
    payment_method_ready: Boolean(extras.default_payment_method),
    default_payment_method: extras.default_payment_method || null,
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
    ...extras,
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

async function fetchDefaultPaymentMethodSummary(stripeCustomerId) {
  if (!stripeCustomerId) return null;

  const stripe = getStripeClient();
  const customer = await stripe.customers.retrieve(stripeCustomerId, {
    expand: ['invoice_settings.default_payment_method'],
  });

  if (typeof customer === 'string' || customer.deleted) {
    return null;
  }

  const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;
  if (!defaultPaymentMethod || typeof defaultPaymentMethod === 'string') {
    return null;
  }

  return mapPaymentMethodSummary(defaultPaymentMethod);
}

async function attachPaymentMethodIfNeeded(stripeCustomerId, paymentMethodId) {
  if (!paymentMethodId) return null;

  const stripe = getStripeClient();

  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (paymentMethod.customer && paymentMethod.customer !== stripeCustomerId) {
    throw new ConflictError('Payment method already belongs to another customer.');
  }

  if (!paymentMethod.customer) {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });
  }

  await stripe.customers.update(stripeCustomerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  const refreshedPaymentMethod = paymentMethod.customer
    ? paymentMethod
    : await stripe.paymentMethods.retrieve(paymentMethodId);

  return mapPaymentMethodSummary(refreshedPaymentMethod);
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

function normalizeTrialEnd(trialEnd) {
  if (!trialEnd) return null;

  const asDate = trialEnd instanceof Date ? trialEnd : new Date(trialEnd);
  if (Number.isNaN(asDate.getTime())) {
    throw new ValidationError('Invalid trial end date.');
  }

  if (asDate.getTime() <= Date.now()) {
    return null;
  }

  return Math.floor(asDate.getTime() / 1000);
}

async function createStripeSubscription({
  business,
  stripeCustomerId,
  stripePriceId,
  paymentMethodId = null,
  trialEnd = null,
  useDefaultTrial = true,
}) {
  const stripe = getStripeClient();
  const stripePayload = {
    customer: stripeCustomerId,
    items: [{ price: stripePriceId }],
    payment_behavior: paymentMethodId ? 'default_incomplete' : undefined,
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      business_id: business.id,
      business_name: business.name,
    },
  };

  const normalizedTrialEnd = normalizeTrialEnd(trialEnd);
  if (normalizedTrialEnd) {
    stripePayload.trial_end = normalizedTrialEnd;
  } else if (useDefaultTrial) {
    stripePayload.trial_period_days = env.STRIPE_SUBSCRIPTION_TRIAL_DAYS;
  }

  return stripe.subscriptions.create(stripePayload);
}

async function resolveTrialWindowForUser(userId) {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      trial_started_at: true,
      trial_ends_at: true,
    },
  });

  if (!user?.trial_ends_at) {
    return null;
  }

  const trialEnd = new Date(user.trial_ends_at);
  if (trialEnd.getTime() <= Date.now()) {
    return null;
  }

  return {
    trial_started_at: user.trial_started_at ? new Date(user.trial_started_at) : null,
    trial_ends_at: trialEnd,
  };
}

async function getStatus(businessId) {
  if (!businessId) throw new ValidationError('business_id is required.');
  const subscription = await prisma.businessSubscription.findFirst({
    where: { business_id: businessId },
    orderBy: { updatedAt: 'desc' },
  });
  const defaultPaymentMethod = subscription?.stripe_customer_id
    ? await fetchDefaultPaymentMethodSummary(subscription.stripe_customer_id)
    : null;

  return mapSubscriptionRecord(subscription, {
    default_payment_method: defaultPaymentMethod,
  });
}

async function startSubscription(businessId, input = {}) {
  if (!businessId) throw new ValidationError('business_id is required.');

  const business = await getBusinessOrThrow(businessId);
  const existing = await findExistingSubscription(businessId);

  if (existing) {
    const defaultPaymentMethod = existing.stripe_customer_id
      ? await fetchDefaultPaymentMethodSummary(existing.stripe_customer_id)
      : null;

    return {
      already_active: true,
      ...mapSubscriptionRecord(existing, {
        default_payment_method: defaultPaymentMethod,
      }),
    };
  }

  const stripe = getStripeClient();
  const stripeCustomerId = await ensureStripeCustomer(business, input);
  const stripePriceId = await ensureSubscriptionPrice();

  if (input.payment_method_id) {
    await attachPaymentMethodIfNeeded(stripeCustomerId, input.payment_method_id);
  }

  const stripeSubscription = await createStripeSubscription({
    business,
    stripeCustomerId,
    stripePriceId,
    paymentMethodId: input.payment_method_id || null,
    trialEnd: input.trial_end || null,
    useDefaultTrial: true,
  });

  const localSubscription = await upsertLocalSubscription(
    businessId,
    stripeSubscription,
    stripeCustomerId,
    stripePriceId
  );

  const clientSecret = stripeSubscription.latest_invoice?.payment_intent?.client_secret || null;
  const defaultPaymentMethod = await fetchDefaultPaymentMethodSummary(stripeCustomerId);

  return {
    already_active: false,
    client_secret: clientSecret,
    ...mapSubscriptionRecord(localSubscription, {
      default_payment_method: defaultPaymentMethod,
    }),
  };
}

async function ensureTrialSubscriptionForBusiness({ userId, businessId }) {
  if (!businessId) {
    throw new ValidationError('business_id is required.');
  }

  const business = await getBusinessOrThrow(businessId);
  const existing = await findExistingSubscription(businessId);
  if (existing) {
    const defaultPaymentMethod = existing.stripe_customer_id
      ? await fetchDefaultPaymentMethodSummary(existing.stripe_customer_id)
      : null;

    return {
      already_active: true,
      ...mapSubscriptionRecord(existing, {
        default_payment_method: defaultPaymentMethod,
      }),
    };
  }

  const trialWindow = await resolveTrialWindowForUser(userId || business.owner_id || business.owner?.id);
  const stripeCustomerId = await ensureStripeCustomer(business, {
    customer_email: business.company_email || business.owner?.email || undefined,
    customer_phone: business.company_phone || business.owner?.phone_number || undefined,
  });
  const stripePriceId = await ensureSubscriptionPrice();

  const stripeSubscription = await createStripeSubscription({
    business,
    stripeCustomerId,
    stripePriceId,
    trialEnd: trialWindow?.trial_ends_at || null,
    useDefaultTrial: false,
  });

  const localSubscription = await upsertLocalSubscription(
    businessId,
    stripeSubscription,
    stripeCustomerId,
    stripePriceId
  );

  const defaultPaymentMethod = await fetchDefaultPaymentMethodSummary(stripeCustomerId);

  return {
    already_active: false,
    ...mapSubscriptionRecord(localSubscription, {
      default_payment_method: defaultPaymentMethod,
    }),
  };
}

async function createSetupIntent(businessId) {
  if (!businessId) throw new ValidationError('business_id is required.');

  const business = await getBusinessOrThrow(businessId);
  const stripe = getStripeClient();
  const stripeCustomerId = await ensureStripeCustomer(business, {
    customer_email: business.company_email || business.owner?.email || undefined,
    customer_phone: business.company_phone || business.owner?.phone_number || undefined,
  });

  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    usage: 'off_session',
    metadata: {
      business_id: business.id,
      business_name: business.name,
    },
  });

  return {
    client_secret: setupIntent.client_secret,
    setup_intent_id: setupIntent.id,
    stripe_customer_id: stripeCustomerId,
  };
}

async function savePaymentMethod(businessId, paymentMethodId) {
  if (!businessId) throw new ValidationError('business_id is required.');
  if (!paymentMethodId) throw new ValidationError('payment_method_id is required.');

  const business = await getBusinessOrThrow(businessId);
  const stripeCustomerId = await ensureStripeCustomer(business, {
    customer_email: business.company_email || business.owner?.email || undefined,
    customer_phone: business.company_phone || business.owner?.phone_number || undefined,
  });

  const paymentMethod = await attachPaymentMethodIfNeeded(stripeCustomerId, paymentMethodId);

  return {
    success: true,
    stripe_customer_id: stripeCustomerId,
    payment_method: paymentMethod,
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

  const defaultPaymentMethod = updated.stripe_customer_id
    ? await fetchDefaultPaymentMethodSummary(updated.stripe_customer_id)
    : null;

  return mapSubscriptionRecord(updated, {
    default_payment_method: defaultPaymentMethod,
  });
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

  const defaultPaymentMethod = updated.stripe_customer_id
    ? await fetchDefaultPaymentMethodSummary(updated.stripe_customer_id)
    : null;

  return mapSubscriptionRecord(updated, {
    default_payment_method: defaultPaymentMethod,
  });
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
  ensureTrialSubscriptionForBusiness,
  createSetupIntent,
  savePaymentMethod,
  cancelSubscription,
  resumeSubscription,
  handleWebhookEvent,
};
