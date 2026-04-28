/**
 * Environment configuration loader.
 * Centralizes all environment variable access with defaults and validation.
 */
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'INTERNAL_API_KEY',
  ];

  const missingProd = productionRequired.filter(v => !process.env[v]);
  if (missingProd.length > 0) {
    throw new Error(`Production environment missing: ${missingProd.join(', ')}`);
  }
}

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
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

  // Twilio
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
  TWILIO_NUMBER_COUNTRY_CODE: process.env.TWILIO_NUMBER_COUNTRY_CODE || 'US',
  TWILIO_SMS_WEBHOOK_URL: process.env.TWILIO_SMS_WEBHOOK_URL || 'https://api.myajicore.com/webhooks/sms/inbound',
  TWILIO_VOICE_WEBHOOK_URL: process.env.TWILIO_VOICE_WEBHOOK_URL || 'https://api.myajicore.com/webhooks/call/inbound',
  TWILIO_STATUS_CALLBACK_URL: process.env.TWILIO_STATUS_CALLBACK_URL,

  // AI Service
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:4000',
  AI_SERVICE_API_KEY: process.env.AI_SERVICE_API_KEY,

  // Internal API Key
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,

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
