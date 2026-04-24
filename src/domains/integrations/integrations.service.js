/**
 * Integrations Service
 * Handles third-party integration logic (Stripe, etc.)
 */

const prisma = require('../../lib/prisma');
const { ValidationError } = require('../../utils/errors');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_CLIENT_ID = process.env.STRIPE_CLIENT_ID;
const STRIPE_REDIRECT_URI = process.env.STRIPE_REDIRECT_URI || 'http://localhost:3000/api/integrations/stripe/callback';

const STRIPE_CONNECT_RETURN_URL = process.env.STRIPE_CONNECT_RETURN_URL
  || process.env.FRONTEND_URL
  || 'http://localhost:3000/settings/payments?stripe=return';

const STRIPE_CONNECT_REFRESH_URL = process.env.STRIPE_CONNECT_REFRESH_URL
  || STRIPE_CONNECT_RETURN_URL;

async function stripePost(path, params) {
  if (!STRIPE_SECRET_KEY) {
    throw new ValidationError('Stripe secret key is not configured on this server');
  }

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || `Stripe request failed (${response.status})`;
    throw new ValidationError(message);
  }

  return payload;
}

function buildStripeOAuthUrl(businessId) {
  if (!STRIPE_CLIENT_ID) {
    throw new ValidationError('Stripe integration is not configured on this server');
  }

  const stripeConnectUrl = new URL('https://connect.stripe.com/oauth/authorize');
  stripeConnectUrl.searchParams.append('client_id', STRIPE_CLIENT_ID);
  stripeConnectUrl.searchParams.append('state', businessId);
  stripeConnectUrl.searchParams.append('scope', 'read_write');
  stripeConnectUrl.searchParams.append('redirect_uri', STRIPE_REDIRECT_URI);
  return stripeConnectUrl.toString();
}

/**
 * Generate Stripe Connect onboarding URL.
 *
 * Preferred path (when STRIPE_SECRET_KEY is present):
 * - Ensures we have a Stripe connected account (Express)
 * - Creates an account onboarding link (Account Link URL)
 *
 * Fallback path: OAuth URL (legacy / minimal setup)
 */
async function getStripeConnectUrl(businessId) {
  if (!businessId) {
    throw new ValidationError('business_id is required');
  }

  // Preferred: Express Connect onboarding (Account Link URL)
  if (STRIPE_SECRET_KEY) {
    const financeSettings = await prisma.businessFinanceSettings.upsert({
      where: { business_id: businessId },
      create: { business_id: businessId },
      update: {},
      select: { business_id: true, stripe_account_id: true },
    });

    let stripeAccountId = financeSettings.stripe_account_id;

    if (!stripeAccountId) {
      const account = await stripePost('/v1/accounts', {
        type: 'express',
        'capabilities[card_payments][requested]': 'true',
        'capabilities[transfers][requested]': 'true',
      });

      stripeAccountId = account.id;

      await prisma.businessFinanceSettings.update({
        where: { business_id: businessId },
        data: {
          stripe_account_id: stripeAccountId,
          stripe_connected_at: new Date(),
        },
      });
    }

    const accountLink = await stripePost('/v1/account_links', {
      account: stripeAccountId,
      refresh_url: STRIPE_CONNECT_REFRESH_URL,
      return_url: STRIPE_CONNECT_RETURN_URL,
      type: 'account_onboarding',
    });

    if (!accountLink?.url) {
      throw new ValidationError('Stripe did not return an onboarding URL');
    }

    return { url: accountLink.url };
  }

  // Fallback: OAuth URL
  return { url: buildStripeOAuthUrl(businessId) };
}

module.exports = {
  getStripeConnectUrl,
};

