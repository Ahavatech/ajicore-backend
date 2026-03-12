/**
 * Auth Service
 * Business logic for user registration, login, and token management.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const env = require('../../config/env');
const logger = require('../../utils/logger');

const SALT_ROUNDS = 12;

/**
 * Register a new user with email and password.
 * Optionally creates a Business record linked to the user.
 */
async function signup({ email, password, name, business_name, industry }) {
  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    const err = new Error('An account with this email already exists.');
    err.statusCode = 409;
    throw err;
  }

  // Validate password strength
  if (!password || password.length < 8) {
    const err = new Error('Password must be at least 8 characters long.');
    err.statusCode = 400;
    throw err;
  }

  // Hash password
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user and optionally a business in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        password_hash,
        name: name || null,
      },
    });

    let business = null;
    if (business_name) {
      business = await tx.business.create({
        data: {
          name: business_name,
          industry: industry || 'General',
          owner_id: user.id,
        },
      });
    }

    return { user, business };
  });

  // Generate JWT
  const token = generateToken(result.user);

  logger.info(`New user registered: ${result.user.email}`);

  return {
    message: 'Account created successfully.',
    token,
    user: sanitizeUser(result.user),
    business: result.business || null,
  };
}

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

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  // Generate JWT
  const token = generateToken(user);

  logger.info(`User signed in: ${user.email}`);

  return {
    message: 'Signed in successfully.',
    token,
    user: sanitizeUser(user),
  };
}

/**
 * Get user by ID (for authenticated /me endpoint).
 */
async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      businesses: true,
    },
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

// --- Helpers ---

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

module.exports = { signup, signin, getUserById, changePassword, verifyToken };