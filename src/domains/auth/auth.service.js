/**
 * Auth Service
 * Business logic for user registration, login, token management,
 * Google OAuth, and multi-step onboarding flow.
 *
 * Onboarding Steps:
 *   Step 1: Account creation (email+password or Google) — handled by signup/googleSignup
 *   Step 2: Organization contact info (first_name, last_name, company_name, company_email, company_type, business_structure)
 *   2→3:    Phone verification via SMS OTP (send-otp / verify-otp / skip-otp)
 *   Step 3: AI business number (search_type, city/area_code/toll_free, phone_number) — can be skipped
 *   Step 4: Service setup (home_base_zip, service_radius_miles, cost_per_mile_over_radius)
 *   Step 5: Logo upload (logo_url) — marks onboarding complete
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const prisma = require('../../lib/prisma');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { ValidationError, ConflictError, AuthenticationError, NotFoundError } = require('../../utils/errors');

const SALT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 10;
const RESET_CODE_EXPIRY_MINUTES = 10;
const TWILIO_AVAILABLE_NUMBER_LIMIT = 5;

// ============================================
// Step 1: Account Creation
// ============================================

/**
 * Register a new user with email and password (Step 1).
 */
async function signup({ email, password }) {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new ConflictError('An account with this email already exists.');
  }

  if (!password || password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long.');
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password_hash,
      auth_provider: 'Email',
      onboarding_step: 2,
    },
  });

  const token = generateToken(user);
  logger.info(`New user registered (email): ${user.email}`);

  return {
    message: 'Account created successfully.',
    token,
    user: sanitizeUser(user),
    onboarding_step: 2,
  };
}

/**
 * Register or sign in a user via Google OAuth (Step 1).
 * If the Google account already exists, sign them in.
 * If it's new, create the user and start onboarding.
 */
async function googleSignup({ google_id, email, first_name, last_name }) {
  if (!google_id || !email) {
    throw new ValidationError('Google ID and email are required.');
  }

  // Check if user already exists by google_id
  let user = await prisma.user.findUnique({ where: { google_id } });

  if (user) {
    // Existing Google user — sign them in
    const token = generateToken(user);
    logger.info(`Google user signed in: ${user.email}`);
    return {
      message: 'Signed in successfully.',
      token,
      user: sanitizeUser(user),
      onboarding_step: user.onboarding_step,
      is_new: false,
    };
  }

  // Check if email already exists with a different provider
  const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existingEmail) {
    throw new ConflictError('An account with this email already exists. Please sign in with your email and password.');
  }

  // Create new Google user
  user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      google_id,
      first_name: first_name || null,
      last_name: last_name || null,
      auth_provider: 'Google',
      onboarding_step: 2,
    },
  });

  const token = generateToken(user);
  logger.info(`New user registered (Google): ${user.email}`);

  return {
    message: 'Account created successfully.',
    token,
    user: sanitizeUser(user),
    onboarding_step: 2,
    is_new: true,
  };
}

// ============================================
// Step 2: Organization Contact Info
// ============================================

/**
 * Save organization contact info and create the Business record.
 * Required: first_name, last_name, company_name, company_email, business_structure
 * Optional: company_type
 */
async function onboardingStep2(userId, data) {
  const { first_name, last_name, company_name, company_email, company_type, business_structure } = data;

  if (!first_name || !last_name || !company_name || !company_email || !business_structure) {
    throw new ValidationError('First name, last name, company name, company email, and business structure are required.');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update user with name info
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        first_name,
        last_name,
        onboarding_step: 3,
      },
    });

    // Create or update the business
    let business = await tx.business.findFirst({ where: { owner_id: userId } });

    if (business) {
      business = await tx.business.update({
        where: { id: business.id },
        data: {
          name: company_name,
          company_email: company_email,
          company_type: company_type || null,
          business_structure: business_structure,
          industry: company_type || 'General',
          internal_api_token: business.internal_api_token || randomUUID(),
        },
      });
    } else {
      business = await tx.business.create({
        data: {
          name: company_name,
          industry: company_type || 'General',
          owner_id: userId,
          company_email: company_email,
          company_type: company_type || null,
          business_structure: business_structure,
          internal_api_token: randomUUID(),
        },
      });
    }

    return { user, business };
  });

  logger.info(`Onboarding step 2 completed for user: ${result.user.email}`);

  return {
    message: 'Organization contact info saved.',
    user: sanitizeUser(result.user),
    business: sanitizeBusiness(result.business),
    onboarding_step: 3,
  };
}

// ============================================
// Step 3: AI Business Number
// ============================================

/**
 * Return a list of available Twilio phone numbers based on search type.
 *
 * @param {string} type - 'city' | 'area_code' | 'toll_free'
 * @param {string} [city] - city name (used when type=city)
 * @param {string} [area_code] - area code digits (used when type=area_code)
 */
async function getAvailableNumbers({ type, city, area_code }) {
  const validTypes = ['city', 'area_code', 'toll_free'];
  if (!type || !validTypes.includes(type)) {
    throw new ValidationError(`type must be one of: ${validTypes.join(', ')}`);
  }

  const client = getTwilioClient();
  const countryCode = normalizeTwilioCountryCode(env.TWILIO_NUMBER_COUNTRY_CODE);
  const searchParams = { limit: TWILIO_AVAILABLE_NUMBER_LIMIT };

  if (type === 'area_code') {
    const cleaned = String(area_code || '').replace(/\D/g, '').slice(0, 3);
    if (cleaned.length < 3) throw new ValidationError('area_code must be a 3-digit code.');
    searchParams.areaCode = Number(cleaned);
  }

  if (type === 'city') {
    const normalizedCity = String(city || '').trim();
    if (!normalizedCity) throw new ValidationError('city is required when type is city.');
    searchParams.inRegion = normalizedCity;
  }

  let incomingNumbers;
  try {
    const availablePhoneNumbers = client.availablePhoneNumbers(countryCode);
    incomingNumbers = type === 'toll_free'
      ? await availablePhoneNumbers.tollFree.list(searchParams)
      : await availablePhoneNumbers.local.list(searchParams);
  } catch (err) {
    logger.error(`Twilio available number lookup failed: ${err.message}`);
    throw new ValidationError('Unable to fetch available Twilio phone numbers right now.');
  }

  const numbers = incomingNumbers.map((record) => ({
    phone_number: record.phoneNumber,
    friendly_name: record.friendlyName || record.phoneNumber,
    locality: record.locality || null,
    region: record.region || null,
    postal_code: record.postalCode || null,
    country: record.isoCountry || countryCode,
    capabilities: {
      voice: Boolean(record.capabilities?.voice),
      sms: Boolean(record.capabilities?.sms),
      mms: Boolean(record.capabilities?.mms),
    },
    type: type === 'toll_free' ? 'toll_free' : 'local',
    area_code: extractAreaCode(record.phoneNumber),
  }));

  return {
    type,
    country: countryCode,
    numbers,
    count: numbers.length,
  };
}

/**
 * Provision the selected AI business phone number.
 * @param {string} userId
 * @param {object} data - { phone_number, search_type, city?, area_code? }
 */
async function onboardingStep3(userId, data) {
  const { phone_number, search_type } = data;

  if (!phone_number) throw new ValidationError('phone_number is required.');
  if (!search_type) throw new ValidationError('search_type is required.');

  const business = await prisma.business.findFirst({ where: { owner_id: userId } });
  if (!business) {
    throw new ValidationError('No business found. Please complete step 2 first.');
  }

  if (business.twilio_phone_sid && business.ai_phone_number && business.ai_phone_number !== phone_number) {
    throw new ValidationError('This business already has a provisioned Twilio number.');
  }

  const client = getTwilioClient();
  const normalizedPhoneNumber = normalizeE164Number(phone_number);
  const friendlyName = buildBusinessPhoneFriendlyName(business.name, normalizedPhoneNumber);

  let provisionedNumber;
  try {
    provisionedNumber = await client.incomingPhoneNumbers.create(buildIncomingPhoneNumberPayload({
      phoneNumber: normalizedPhoneNumber,
      friendlyName,
    }));

    if (env.TWILIO_MESSAGING_SERVICE_SID) {
      await client.messaging.v1
        .services(env.TWILIO_MESSAGING_SERVICE_SID)
        .phoneNumbers
        .create({ phoneNumberSid: provisionedNumber.sid });
    }
  } catch (err) {
    logger.error(`Twilio phone number provisioning failed for business ${business.id}: ${err.message}`);
    throw new ValidationError('Unable to provision the selected Twilio phone number.');
  }

  const [user, updatedBusiness] = await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { onboarding_step: 4 },
    }),
    prisma.business.update({
      where: { id: business.id },
      data: {
        ai_phone_number: provisionedNumber.phoneNumber,
        dedicated_phone_number: provisionedNumber.phoneNumber,
        ai_phone_country: provisionedNumber.isoCountry || data.country || null,
        ai_phone_area_code: data.area_code || extractAreaCode(provisionedNumber.phoneNumber),
        twilio_phone_sid: provisionedNumber.sid,
        twilio_phone_friendly_name: provisionedNumber.friendlyName || friendlyName,
      },
    }),
  ]);

  logger.info(`Onboarding step 3 completed for user: ${user.email}, AI number: ${provisionedNumber.phoneNumber}`);

  return {
    message: 'AI business number provisioned.',
    user: sanitizeUser(user),
    business: sanitizeBusiness(updatedBusiness),
    ai_phone_number: provisionedNumber.phoneNumber,
    twilio_phone_sid: provisionedNumber.sid,
    onboarding_step: 4,
  };
}

/**
 * Skip step 3 (AI business number) and continue to step 4.
 */
async function skipStep3(userId) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { onboarding_step: 4 },
  });

  logger.info(`Onboarding step 3 skipped for user: ${user.email}`);

  return {
    message: 'AI number setup skipped.',
    user: sanitizeUser(user),
    onboarding_step: 4,
  };
}

// ============================================
// Step 4: Service Setup
// ============================================

/**
 * Save service area configuration.
 * Required: home_base_zip, service_radius_miles, cost_per_mile_over_radius
 */
async function onboardingStep4(userId, data) {
  const { home_base_zip, service_radius_miles, cost_per_mile_over_radius } = data;

  if (!home_base_zip || service_radius_miles === undefined || service_radius_miles === null || cost_per_mile_over_radius === undefined || cost_per_mile_over_radius === null) {
    throw new ValidationError('home_base_zip, service_radius_miles, and cost_per_mile_over_radius are required.');
  }

  const radiusMiles = parseFloat(service_radius_miles);
  const costPerMile = parseFloat(cost_per_mile_over_radius);

  if (isNaN(radiusMiles) || radiusMiles < 0) {
    throw new ValidationError('service_radius_miles must be a non-negative number.');
  }
  if (isNaN(costPerMile) || costPerMile < 0) {
    throw new ValidationError('cost_per_mile_over_radius must be a non-negative number.');
  }

  const business = await prisma.business.findFirst({ where: { owner_id: userId } });
  if (!business) {
    throw new ValidationError('No business found. Please complete step 2 first.');
  }

  const [user, updatedBusiness] = await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { onboarding_step: 5 },
    }),
    prisma.business.update({
      where: { id: business.id },
      data: {
        home_base_zip,
        service_radius_miles: radiusMiles,
        cost_per_mile_over_radius: costPerMile,
      },
    }),
  ]);

  logger.info(`Onboarding step 4 completed for user: ${user.email}`);

  return {
    message: 'Service setup saved.',
    user: sanitizeUser(user),
    business: sanitizeBusiness(updatedBusiness),
    onboarding_step: 5,
  };
}

// ============================================
// Step 5: Logo Upload (Completion)
// ============================================

/**
 * Save organization logo URL and mark onboarding as complete.
 * logo_url is optional — user may skip uploading.
 */
async function onboardingStep5(userId, data) {
  const { logo_url } = data;

  const business = await prisma.business.findFirst({ where: { owner_id: userId } });
  if (!business) {
    throw new ValidationError('No business found. Please complete step 2 first.');
  }

  const [user, updatedBusiness] = await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: {
        onboarding_step: 6,
        onboarding_completed: true,
      },
    }),
    prisma.business.update({
      where: { id: business.id },
      data: { logo_url: logo_url || null },
    }),
  ]);

  logger.info(`Onboarding completed for user: ${user.email}`);

  return {
    message: 'Account created successfully!',
    user: sanitizeUser(user),
    business: sanitizeBusiness(updatedBusiness),
    ai_phone_number: updatedBusiness.ai_phone_number || null,
    onboarding_completed: true,
  };
}

// ============================================
// Existing Auth Methods
// ============================================

/**
 * Authenticate a user with email and password.
 */
async function signin({ email, password }) {
  if (!email || !password) {
    throw new ValidationError('Email and password are required.');
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    throw new AuthenticationError('Invalid email or password.');
  }

  if (user.auth_provider === 'Google' && !user.password_hash) {
    throw new ValidationError('This account uses Google sign-in. Please sign in with Google.');
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new AuthenticationError('Invalid email or password.');
  }

  const token = generateToken(user);
  logger.info(`User signed in: ${user.email}`);

  return {
    message: 'Signed in successfully.',
    token,
    user: sanitizeUser(user),
    onboarding_step: user.onboarding_step,
    onboarding_completed: user.onboarding_completed,
  };
}

/**
 * Get user by ID (for authenticated /me endpoint).
 */
async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { businesses: true },
  });

  if (!user) return null;
  return { ...sanitizeUser(user), businesses: user.businesses.map(sanitizeBusiness) };
}

async function forgotPassword(email) {
  if (!email) {
    throw new ValidationError('Email is required.');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  let dev_reset_code = null;

  if (user && user.auth_provider !== 'Google') {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const expires = new Date(Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        phone_otp: code,
        phone_otp_expires_at: expires,
      },
    });

    if (!env.isProduction) {
      dev_reset_code = code;
    }

    logger.info(`Password reset code generated for user: ${user.email}`);
  }

  const response = {
    message: 'If an account exists for this email, a password reset code has been generated.',
  };

  if (dev_reset_code) {
    response.dev_reset_code = dev_reset_code;
  }

  return response;
}

async function verifyResetCode(email, code) {
  if (!email || !code) {
    throw new ValidationError('Email and code are required.');
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  validateStoredResetCode(user, code);

  return {
    message: 'Reset code verified.',
    valid: true,
  };
}

async function resetPassword(email, code, newPassword) {
  if (!email || !code || !newPassword) {
    throw new ValidationError('Email, code, and new_password are required.');
  }

  if (newPassword.length < 8) {
    throw new ValidationError('New password must be at least 8 characters long.');
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  validateStoredResetCode(user, code);

  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash,
      phone_otp: null,
      phone_otp_expires_at: null,
    },
  });

  logger.info(`Password reset completed for user: ${user.email}`);

  return {
    message: 'Password reset successfully.',
  };
}

/**
 * Change user password.
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  if (user.auth_provider === 'Google' && !user.password_hash) {
    throw new ValidationError('This account uses Google sign-in. Password change is not available.');
  }

  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    throw new AuthenticationError('Current password is incorrect.');
  }

  if (!newPassword || newPassword.length < 8) {
    throw new ValidationError('New password must be at least 8 characters long.');
  }

  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { password_hash } });

  logger.info(`Password changed for user: ${user.email}`);
}

async function getInternalApiToken(userId, businessId) {
  const where = businessId
    ? { id: businessId, owner_id: userId }
    : { owner_id: userId };

  const business = await prisma.business.findFirst({
    where,
    orderBy: { createdAt: 'asc' },
    select: { id: true, internal_api_token: true },
  });

  if (!business) {
    throw new NotFoundError('Business');
  }

  return {
    business_id: business.id,
    internal_api_token: business.internal_api_token,
  };
}

/**
 * Verify a JWT token and return the decoded payload.
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// ============================================
// Phone OTP Verification (between Step 2 and Step 3)
// ============================================

/**
 * Generate a 5-digit OTP, save it on the user with a 10-minute expiry,
 * store the phone number on the business, and send the OTP via SMS.
 *
 * In development (no Twilio credentials), the OTP is logged and returned
 * in the response so the flow can be tested without a real Twilio account.
 */
async function sendOtp(userId, { phone_number }) {
  if (!phone_number) throw new ValidationError('phone_number is required.');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found.');

  // Generate a 5-digit OTP
  const otp = Math.floor(10000 + Math.random() * 90000).toString();
  const expires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Persist OTP + expiry and store phone on the business record
  const business = await prisma.business.findFirst({ where: { owner_id: userId } });

  await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { phone_otp: otp, phone_otp_expires_at: expires },
    }),
    business
      ? prisma.business.update({
          where: { id: business.id },
          data: { company_phone: phone_number },
        })
      : Promise.resolve(),
  ]);

  // Send SMS via Twilio if credentials are available, otherwise log
  const hasTwilio = env.TWILIO_ACCOUNT_SID
    && env.TWILIO_AUTH_TOKEN
    && (env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_PHONE_NUMBER);
  let otpForDev = null;

  if (hasTwilio) {
    try {
      const client = getTwilioClient();
      const messagePayload = {
        body: `Your Ajicore verification code is: ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
        to: phone_number,
      };

      if (env.TWILIO_MESSAGING_SERVICE_SID) {
        messagePayload.messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
      } else {
        messagePayload.from = env.TWILIO_PHONE_NUMBER;
      }

      await client.messages.create(messagePayload);
      logger.info(`OTP sent via SMS to ${phone_number} for user: ${user.email}`);
    } catch (err) {
      logger.warn(`Twilio SDK unavailable or SMS send failed for ${user.email}: ${err.message}`);
      if (env.isDevelopment) otpForDev = otp;
    }
  } else {
    logger.warn(`Twilio not configured — OTP for ${user.email}: ${otp}`);
    if (env.isDevelopment) otpForDev = otp;
  }

  const response = {
    message: `A 5-digit OTP has been sent to ${maskPhone(phone_number)}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    phone_number: maskPhone(phone_number),
  };
  if (otpForDev) response.dev_otp = otpForDev;
  return response;
}

/**
 * Validate the OTP the user entered. On success, advances onboarding to step 3.
 */
async function verifyOtp(userId, { otp }) {
  if (!otp) throw new ValidationError('otp is required.');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found.');

  if (!user.phone_otp || !user.phone_otp_expires_at) {
    throw new ValidationError('No OTP found. Please request a new one via send-otp.');
  }

  if (new Date() > new Date(user.phone_otp_expires_at)) {
    await prisma.user.update({
      where: { id: userId },
      data: { phone_otp: null, phone_otp_expires_at: null },
    });
    throw new ValidationError('OTP has expired. Please request a new one.');
  }

  if (user.phone_otp !== otp.toString().trim()) {
    throw new ValidationError('Incorrect OTP. Please try again.');
  }

  // Clear OTP and advance to step 3
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { phone_otp: null, phone_otp_expires_at: null, onboarding_step: 3 },
  });

  logger.info(`Phone OTP verified for user: ${user.email}`);

  return {
    message: 'Phone number verified successfully.',
    user: sanitizeUser(updatedUser),
    onboarding_step: 3,
  };
}

/**
 * Skip phone OTP verification and advance to step 3.
 */
async function skipOtp(userId) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { phone_otp: null, phone_otp_expires_at: null, onboarding_step: 3 },
  });

  logger.info(`Phone OTP skipped for user: ${user.email}`);

  return {
    message: 'Phone verification skipped.',
    user: sanitizeUser(user),
    onboarding_step: 3,
  };
}

// ============================================
// Helpers
// ============================================

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitizeUser(user) {
  const { password_hash, phone_otp, phone_otp_expires_at, ...safe } = user;
  return safe;
}

function sanitizeBusiness(business) {
  if (!business) return business;
  const { internal_api_token, ...safe } = business;
  return safe;
}

function getTwilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new ValidationError('Twilio credentials are not configured.');
  }

  try {
    const twilio = require('twilio');
    return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  } catch (_err) {
    throw new ValidationError('Twilio SDK is not installed. Run npm install to add the twilio package.');
  }
}

function normalizeTwilioCountryCode(countryCode) {
  return String(countryCode || 'US').trim().toUpperCase();
}

function normalizeE164Number(phoneNumber) {
  const normalized = String(phoneNumber || '').trim();
  if (!/^\+\d{8,15}$/.test(normalized)) {
    throw new ValidationError('phone_number must be a valid E.164 phone number.');
  }
  return normalized;
}

function buildBusinessPhoneFriendlyName(businessName, phoneNumber) {
  const baseName = String(businessName || 'Ajicore Business').trim();
  return `${baseName} - ${phoneNumber}`.slice(0, 64);
}

function buildIncomingPhoneNumberPayload({ phoneNumber, friendlyName }) {
  const payload = {
    phoneNumber,
    friendlyName,
  };

  if (env.TWILIO_SMS_WEBHOOK_URL) {
    payload.smsUrl = env.TWILIO_SMS_WEBHOOK_URL;
    payload.smsMethod = 'POST';
  }

  if (env.TWILIO_VOICE_WEBHOOK_URL) {
    payload.voiceUrl = env.TWILIO_VOICE_WEBHOOK_URL;
    payload.voiceMethod = 'POST';
  }

  if (env.TWILIO_STATUS_CALLBACK_URL) {
    payload.statusCallback = env.TWILIO_STATUS_CALLBACK_URL;
    payload.statusCallbackMethod = 'POST';
  }

  return payload;
}

function extractAreaCode(phoneNumber) {
  const digits = String(phoneNumber || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1, 4);
  if (digits.length >= 10) return digits.slice(0, 3);
  return null;
}

function validateStoredResetCode(user, code) {
  if (!user || user.auth_provider === 'Google') {
    throw new ValidationError('Invalid or expired reset code.');
  }

  if (!user.phone_otp || !user.phone_otp_expires_at) {
    throw new ValidationError('Invalid or expired reset code.');
  }

  if (new Date() > new Date(user.phone_otp_expires_at)) {
    throw new ValidationError('Invalid or expired reset code.');
  }

  if (String(user.phone_otp).trim() !== String(code).trim()) {
    throw new ValidationError('Invalid or expired reset code.');
  }
}

/** Mask a phone number for display: +234 ** **** 3239 */
function maskPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  const country = phone.startsWith('+') ? phone.slice(0, phone.indexOf(digits.slice(3, 4)) + 1) : '';
  const last4 = digits.slice(-4);
  return `${country || '+'}** **** ${last4}`;
}

module.exports = {
  signup,
  googleSignup,
  signin,
  getUserById,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  changePassword,
  getInternalApiToken,
  verifyToken,
  onboardingStep2,
  getAvailableNumbers,
  onboardingStep3,
  skipStep3,
  onboardingStep4,
  onboardingStep5,
  sendOtp,
  verifyOtp,
  skipOtp,
};
