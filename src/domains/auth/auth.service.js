/**
 * Auth Service
 * Business logic for user registration, login, token management,
 * Google OAuth, and multi-step onboarding flow.
 *
 * Onboarding Steps:
 *   Step 1: Account creation (email+password or Google) — handled by signup/googleSignup
 *   Step 2: Organization contact info (first_name, last_name, company_name, company_email, company_type, company_phone)
 *   Step 3: Organization address (street, city, postal_code, country)
 *   Step 4: Logo upload (logo_url)
 *   Step 5: AI business number (country, area_code) — can be skipped
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const env = require('../../config/env');
const logger = require('../../utils/logger');

const SALT_ROUNDS = 12;

// ============================================
// Step 1: Account Creation
// ============================================

/**
 * Register a new user with email and password (Step 1).
 */
async function signup({ email, password }) {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    const err = new Error('An account with this email already exists.');
    err.statusCode = 409;
    throw err;
  }

  if (!password || password.length < 8) {
    const err = new Error('Password must be at least 8 characters long.');
    err.statusCode = 400;
    throw err;
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
    const err = new Error('Google ID and email are required.');
    err.statusCode = 400;
    throw err;
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
    const err = new Error('An account with this email already exists. Please sign in with your email and password.');
    err.statusCode = 409;
    throw err;
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
 */
async function onboardingStep2(userId, data) {
  const { first_name, last_name, company_name, company_email, company_type, company_phone } = data;

  if (!first_name || !last_name || !company_name) {
    const err = new Error('First name, last name, and company name are required.');
    err.statusCode = 400;
    throw err;
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
          company_email: company_email || null,
          company_type: company_type || null,
          company_phone: company_phone || null,
        },
      });
    } else {
      business = await tx.business.create({
        data: {
          name: company_name,
          industry: company_type || 'General',
          owner_id: userId,
          company_email: company_email || null,
          company_type: company_type || null,
          company_phone: company_phone || null,
        },
      });
    }

    return { user, business };
  });

  logger.info(`Onboarding step 2 completed for user: ${result.user.email}`);

  return {
    message: 'Organization contact info saved.',
    user: sanitizeUser(result.user),
    business: result.business,
    onboarding_step: 3,
  };
}

// ============================================
// Step 3: Organization Address
// ============================================

/**
 * Save organization address.
 */
async function onboardingStep3(userId, data) {
  const { street, city, postal_code, country } = data;

  if (!street || !city || !postal_code || !country) {
    const err = new Error('Street, city, postal code, and country are required.');
    err.statusCode = 400;
    throw err;
  }

  const business = await prisma.business.findFirst({ where: { owner_id: userId } });
  if (!business) {
    const err = new Error('No business found. Please complete step 2 first.');
    err.statusCode = 400;
    throw err;
  }

  const [user, updatedBusiness] = await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { onboarding_step: 4 },
    }),
    prisma.business.update({
      where: { id: business.id },
      data: { street, city, postal_code, country },
    }),
  ]);

  logger.info(`Onboarding step 3 completed for user: ${user.email}`);

  return {
    message: 'Organization address saved.',
    user: sanitizeUser(user),
    business: updatedBusiness,
    onboarding_step: 4,
  };
}

// ============================================
// Step 4: Logo Upload
// ============================================

/**
 * Save organization logo URL.
 */
async function onboardingStep4(userId, data) {
  const { logo_url } = data;

  const business = await prisma.business.findFirst({ where: { owner_id: userId } });
  if (!business) {
    const err = new Error('No business found. Please complete step 2 first.');
    err.statusCode = 400;
    throw err;
  }

  const [user, updatedBusiness] = await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { onboarding_step: 5 },
    }),
    prisma.business.update({
      where: { id: business.id },
      data: { logo_url: logo_url || null },
    }),
  ]);

  logger.info(`Onboarding step 4 completed for user: ${user.email}`);

  return {
    message: 'Logo saved.',
    user: sanitizeUser(user),
    business: updatedBusiness,
    onboarding_step: 5,
  };
}

// ============================================
// Step 5: AI Business Number
// ============================================

/**
 * Generate and save AI business phone number.
 */
async function onboardingStep5(userId, data) {
  const { country, area_code } = data;

  const business = await prisma.business.findFirst({ where: { owner_id: userId } });
  if (!business) {
    const err = new Error('No business found. Please complete step 2 first.');
    err.statusCode = 400;
    throw err;
  }

  // Generate a placeholder AI phone number
  // In production, this would call Twilio to provision a real number
  const randomDigits = Math.floor(1000000 + Math.random() * 9000000).toString();
  const aiPhoneNumber = `+${getCountryCode(country)}${area_code || ''}${randomDigits}`;

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
      data: {
        ai_phone_number: aiPhoneNumber,
        ai_phone_country: country || null,
        ai_phone_area_code: area_code || null,
        dedicated_phone_number: aiPhoneNumber,
      },
    }),
  ]);

  logger.info(`Onboarding completed for user: ${user.email}, AI number: ${aiPhoneNumber}`);

  return {
    message: 'Account created successfully!',
    user: sanitizeUser(user),
    business: updatedBusiness,
    ai_phone_number: aiPhoneNumber,
    onboarding_completed: true,
  };
}

/**
 * Skip step 5 (AI business number) and complete onboarding.
 */
async function skipStep5(userId) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      onboarding_step: 6,
      onboarding_completed: true,
    },
  });

  logger.info(`Onboarding completed (step 5 skipped) for user: ${user.email}`);

  return {
    message: 'Account created successfully!',
    user: sanitizeUser(user),
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
    const err = new Error('Email and password are required.');
    err.statusCode = 400;
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  if (user.auth_provider === 'Google' && !user.password_hash) {
    const err = new Error('This account uses Google sign-in. Please sign in with Google.');
    err.statusCode = 400;
    throw err;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
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
  return { ...sanitizeUser(user), businesses: user.businesses };
}

/**
 * Change user password.
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }

  if (user.auth_provider === 'Google' && !user.password_hash) {
    const err = new Error('This account uses Google sign-in. Password change is not available.');
    err.statusCode = 400;
    throw err;
  }

  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    const err = new Error('Current password is incorrect.');
    err.statusCode = 401;
    throw err;
  }

  if (!newPassword || newPassword.length < 8) {
    const err = new Error('New password must be at least 8 characters long.');
    err.statusCode = 400;
    throw err;
  }

  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { password_hash } });

  logger.info(`Password changed for user: ${user.email}`);
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
  const { password_hash, ...safe } = user;
  return safe;
}

/**
 * Get country dialing code from country name.
 */
function getCountryCode(country) {
  const codes = {
    'United States': '1',
    'US': '1',
    'Canada': '1',
    'CA': '1',
    'United Kingdom': '44',
    'UK': '44',
    'Australia': '61',
    'AU': '61',
    'Germany': '49',
    'DE': '49',
    'France': '33',
    'FR': '33',
    'India': '91',
    'IN': '91',
    'Nigeria': '234',
    'NG': '234',
    'South Africa': '27',
    'ZA': '27',
    'Mexico': '52',
    'MX': '52',
    'Brazil': '55',
    'BR': '55',
  };
  return codes[country] || '1';
}

module.exports = {
  signup,
  googleSignup,
  signin,
  getUserById,
  changePassword,
  verifyToken,
  onboardingStep2,
  onboardingStep3,
  onboardingStep4,
  onboardingStep5,
  skipStep5,
};