/**
 * Environment configuration loader.
 * Centralizes all environment variable access with defaults and validation.
 */
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const localEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

function maskPhoneForEnvError(value) {
  const raw = String(value || '').trim();
  if (!raw) return '[empty]';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return raw;
  return `${raw.startsWith('+') ? '+' : ''}***${digits.slice(-4)}`;
}

// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL',
  'NODE_ENV',
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}\n` +
    `To fix, set these in your .env file or system environment`
  );
}

// Additional validation for production
if (process.env.NODE_ENV === 'production') {
  const productionRequired = [
    'STRIPE_SECRET_KEY',
    'INTERNAL_API_KEY',
  ];

  const missingProd = productionRequired.filter(v => !process.env[v]);
  if (missingProd.length > 0) {
    throw new Error(`Production environment missing: ${missingProd.join(', ')}`);
  }

  const hasTwilioAccountPair = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  const hasTwilioApiKeyTriple = Boolean(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_API_KEY_SID
    && process.env.TWILIO_API_KEY_SECRET
  );
  if (!hasTwilioAccountPair && !hasTwilioApiKeyTriple) {
    throw new Error(
      'Production Twilio configuration missing: set either '
      + 'TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN or '
      + 'TWILIO_ACCOUNT_SID + TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET.'
    );
  }

  if (!process.env.TWILIO_MESSAGING_SERVICE_SID && !process.env.TWILIO_PHONE_NUMBER) {
    throw new Error('Production Twilio outbound sender missing: set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER.');
  }

  const productionTwilioPhoneNumber = String(process.env.TWILIO_PHONE_NUMBER || '').trim();
  if (productionTwilioPhoneNumber && ['+1234567890', '+10000000000'].includes(productionTwilioPhoneNumber)) {
    throw new Error(
      `Production TWILIO_PHONE_NUMBER is still a placeholder (${maskPhoneForEnvError(productionTwilioPhoneNumber)}). `
      + 'This value is coming from the deployment runtime environment, not the repo .env file. '
      + 'Update the hosting provider runtime env for TWILIO_PHONE_NUMBER and redeploy.'
    );
  }

  const smtpRequired = [
    'MAIL_PROVIDER',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'MAIL_FROM_EMAIL',
  ];

  const missingSmtp = smtpRequired.filter(v => !process.env[v]);
  if (missingSmtp.length > 0) {
    throw new Error(`Production SMTP configuration missing: ${missingSmtp.join(', ')}`);
  }

  const productionMailProvider = String(process.env.MAIL_PROVIDER || '').trim().toLowerCase();
  if (!['smtp', 'gmail', 'google'].includes(productionMailProvider)) {
    throw new Error('Production mail provider must be set to smtp, gmail, or google.');
  }
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseInteger(value, defaultValue) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function validateStripeKeyPair(secretKey, publishableKey) {
  if (!secretKey || !publishableKey) return;

  const secretMode = secretKey.startsWith('sk_live_') ? 'live' : secretKey.startsWith('sk_test_') ? 'test' : null;
  const publishableMode = publishableKey.startsWith('pk_live_') ? 'live' : publishableKey.startsWith('pk_test_') ? 'test' : null;

  if (secretMode && publishableMode && secretMode !== publishableMode) {
    throw new Error('Stripe key mode mismatch: do not mix live and test Stripe keys.');
  }
}

validateStripeKeyPair(process.env.STRIPE_SECRET_KEY, process.env.STRIPE_PUBLISHABLE_KEY);

const env = {
  // Server
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // JWT Authentication
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_CURRENCY: (process.env.STRIPE_CURRENCY || 'usd').toLowerCase(),
  STRIPE_SUBSCRIPTION_PRICE_ID: process.env.STRIPE_SUBSCRIPTION_PRICE_ID,
  STRIPE_SUBSCRIPTION_PRICE_AMOUNT: parseInteger(process.env.STRIPE_SUBSCRIPTION_PRICE_AMOUNT, null),
  STRIPE_SUBSCRIPTION_TRIAL_DAYS: parseInteger(process.env.STRIPE_SUBSCRIPTION_TRIAL_DAYS, 21),
  STRIPE_SUBSCRIPTION_PRODUCT_NAME: process.env.STRIPE_SUBSCRIPTION_PRODUCT_NAME || 'Ajicore Business Subscription',

  // Twilio
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
  TWILIO_NUMBER_COUNTRY_CODE: process.env.TWILIO_NUMBER_COUNTRY_CODE || 'US',
  TWILIO_SMS_WEBHOOK_URL: process.env.TWILIO_SMS_WEBHOOK_URL || 'https://api.myajicore.com/webhooks/sms/inbound',
  TWILIO_VOICE_WEBHOOK_URL: process.env.TWILIO_VOICE_WEBHOOK_URL || 'https://api.myajicore.com/webhooks/call/connect',
  TWILIO_STATUS_CALLBACK_URL: process.env.TWILIO_STATUS_CALLBACK_URL,

  // AI Service
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:4000',

  // Internal API Key
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,

  // Mail / SMTP
  MAIL_PROVIDER: process.env.MAIL_PROVIDER || null,
  SMTP_HOST: process.env.SMTP_HOST || null,
  SMTP_PORT: parseInteger(process.env.SMTP_PORT, null),
  SMTP_SECURE: parseBoolean(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER || null,
  SMTP_PASS: process.env.SMTP_PASS || null,
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME || 'Ajicore',
  MAIL_FROM_EMAIL: process.env.MAIL_FROM_EMAIL || null,

  // Password reset
  PASSWORD_RESET_CODE_TTL_MINUTES: parseInteger(process.env.PASSWORD_RESET_CODE_TTL_MINUTES, 10),
  PASSWORD_RESET_CODE_LENGTH: parseInteger(process.env.PASSWORD_RESET_CODE_LENGTH, 5),
  PASSWORD_RESET_ALLOW_EMAIL: parseBoolean(process.env.PASSWORD_RESET_ALLOW_EMAIL, true),
  PASSWORD_RESET_ALLOW_SMS: parseBoolean(process.env.PASSWORD_RESET_ALLOW_SMS, true),

  // Frontend / redirects
  APP_FRONTEND_URL: process.env.APP_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000',

  // Uploads / Cloudinary (optional mirror for local uploads)
  BACKEND_URL: process.env.BACKEND_URL,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || 'ajicore/uploads',
  UPLOAD_RETURN_CLOUDINARY_URL: process.env.UPLOAD_RETURN_CLOUDINARY_URL === 'true',

  // Google Cloud Storage (primary upload destination)
  GCS_PROJECT_ID: process.env.GCS_PROJECT_ID,
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
  GCS_KEY_FILE: process.env.GCS_KEY_FILE,
  STORAGE_MODE: process.env.STORAGE_MODE || 'local', // 'local' | 'gcs'

  // CORS
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',

  // Helpers
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

module.exports = env;
