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
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { ValidationError, ConflictError, AuthenticationError, NotFoundError } = require('../../utils/errors');

const SALT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 10;

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
 * Return a list of available placeholder phone numbers based on search type.
 * In production this would call Twilio's available numbers API.
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

  // Generate realistic-looking placeholder numbers based on search type
  const numbers = [];

  if (type === 'toll_free') {
    const tollFreePrefixes = ['800', '888', '877', '866', '855'];
    for (let i = 0; i < 5; i++) {
      const prefix = tollFreePrefixes[i % tollFreePrefixes.length];
      const digits = Math.floor(1000000 + Math.random() * 9000000).toString();
      numbers.push({
        phone_number: `+1${prefix}${digits}`,
        friendly_name: `(${prefix}) ${digits.slice(0, 3)}-${digits.slice(3)}`,
        type: 'toll_free',
      });
    }
  } else if (type === 'area_code') {
    if (!area_code) throw new ValidationError('area_code is required when type is area_code.');
    const cleaned = area_code.replace(/\D/g, '').slice(0, 3);
    if (cleaned.length < 3) throw new ValidationError('area_code must be a 3-digit code.');
    for (let i = 0; i < 5; i++) {
      const digits = Math.floor(1000000 + Math.random() * 9000000).toString();
      numbers.push({
        phone_number: `+1${cleaned}${digits}`,
        friendly_name: `(${cleaned}) ${digits.slice(0, 3)}-${digits.slice(3)}`,
        type: 'local',
        area_code: cleaned,
      });
    }
  } else {
    // city
    if (!city) throw new ValidationError('city is required when type is city.');
    // Map a few cities to area codes; fall back to a generic local number
    const cityAreaCodes = {
      'new york': '212', 'los angeles': '213', 'chicago': '312',
      'houston': '713', 'phoenix': '602', 'philadelphia': '215',
      'san antonio': '210', 'san diego': '619', 'dallas': '214',
      'san jose': '408', 'austin': '512', 'jacksonville': '904',
      'lagos': '234', 'london': '44', 'toronto': '416',
    };
    const key = city.toLowerCase().trim();
    const areaCode = cityAreaCodes[key] || '555';
    for (let i = 0; i < 5; i++) {
      const digits = Math.floor(1000000 + Math.random() * 9000000).toString();
      numbers.push({
        phone_number: `+1${areaCode}${digits}`,
        friendly_name: `(${areaCode}) ${digits.slice(0, 3)}-${digits.slice(3)}`,
        type: 'local',
        city,
        area_code: areaCode,
      });
    }
  }

  return {
    type,
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

  const [user, updatedBusiness] = await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { onboarding_step: 4 },
    }),
    prisma.business.update({
      where: { id: business.id },
      data: {
        ai_phone_number: phone_number,
        dedicated_phone_number: phone_number,
        ai_phone_country: data.country || null,
        ai_phone_area_code: data.area_code || null,
      },
    }),
  ]);

  logger.info(`Onboarding step 3 completed for user: ${user.email}, AI number: ${phone_number}`);

  return {
    message: 'AI business number provisioned.',
    user: sanitizeUser(user),
    business: sanitizeBusiness(updatedBusiness),
    ai_phone_number: phone_number,
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
  const business = await prisma.business.findFirst({
    where: { id: businessId, owner_id: userId },
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
  const hasTwilio = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER;
  let otpForDev = null;

  if (hasTwilio) {
    try {
      const twilio = require('twilio');
      const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `Your Ajicore verification code is: ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
        from: env.TWILIO_PHONE_NUMBER,
        to: phone_number,
      });
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
