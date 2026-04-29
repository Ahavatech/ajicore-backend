/**
 * Authentication Middleware
 * Validates API keys and JWT tokens for route protection.
 */
const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { verifyToken } = require('../../domains/auth/auth.service');
const { AuthorizationError, NotFoundError, ValidationError } = require('../../utils/errors');

// TEMPORARY: hard-coded fallback for testing while Render env vars are misconfigured.
// TODO: remove and rotate once INTERNAL_API_KEY / AI_SERVICE_API_KEY are set on Render.
const HARDCODED_FALLBACK_API_KEY = 'k9pZ4mX7qW2vR8tL6nB1cY5sH0jF3dA';


const resourceResolvers = {
  customer: (id) => prisma.customer.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  job: (id) => prisma.job.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  quote: (id) => prisma.quote.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  invoice: (id) => prisma.invoice.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  expense: (id) => prisma.expense.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  staff: (id) => prisma.staff.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  material: (id) => prisma.material.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  vehicle: (id) => prisma.vehicle.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  serviceCategory: (id) => prisma.serviceCategory.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  priceBookItem: (id) => prisma.priceBookItem.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  bankTransaction: (id) => prisma.bankTransaction.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  categorizationRule: (id) => prisma.categorizationRule.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  followUp: (id) => prisma.followUp.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  aiEventLog: (id) => prisma.aiEventLog.findUnique({ where: { id }, select: { id: true, business_id: true } }),
  teamCheckin: (id) => prisma.teamCheckin.findUnique({
    where: { id },
    select: { id: true, staff: { select: { business_id: true } } },
  }).then((record) => (record ? { id: record.id, business_id: record.staff.business_id } : null)),
};

function getSourceObject(req, source) {
  if (source === 'query') return req.query;
  if (source === 'params') return req.params;
  return req.body;
}

async function userCanAccessBusiness(userId, businessId) {
  return prisma.business.findFirst({
    where: { id: businessId, owner_id: userId },
    select: { id: true },
  });
}

function getTokenHeader(req, headerName) {
  const value = req.headers[headerName];
  return Array.isArray(value) ? value[0] : value;
}

function safeTokenMatch(expected, actual) {
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

async function resolveBusinessIdForResource(resource, id) {
  const resolver = resourceResolvers[resource];
  if (!resolver) {
    throw new Error(`Unsupported resource resolver: ${resource}`);
  }
  const record = await resolver(id);
  return record?.business_id || null;
}

async function userHasBusinessAccess(user, businessId) {
  if (!user?.id || !businessId) return null;

  if (user.role === 'staff') {
    return user.business_id === businessId ? { id: businessId } : null;
  }

  return userCanAccessBusiness(user.id, businessId);
}

async function staffCanAccessResource(user, resource, resourceId) {
  if (!user?.staff_id) return false;

  if (resource === 'staff') {
    return user.staff_id === resourceId;
  }

  if (resource === 'job') {
    const job = await prisma.job.findUnique({
      where: { id: resourceId },
      select: { assigned_staff_id: true, business_id: true },
    });
    return Boolean(job && job.business_id === user.business_id && job.assigned_staff_id === user.staff_id);
  }

  if (resource === 'quote') {
    const quote = await prisma.quote.findUnique({
      where: { id: resourceId },
      select: { assigned_staff_id: true, business_id: true },
    });
    return Boolean(quote && quote.business_id === user.business_id && quote.assigned_staff_id === user.staff_id);
  }

  return false;
}

function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

function requireBusinessAccess(source = 'query', field = 'business_id', options = {}) {
  const { allowStaff = false } = options;

  return async (req, res, next) => {
    try {
      const businessId = getSourceObject(req, source)?.[field];
      if (!businessId) {
        throw new ValidationError(`${field} is required.`);
      }

      if (req.user.role === 'staff' && !allowStaff) {
        throw new AuthorizationError('You do not have access to this business.');
      }

      const business = await userHasBusinessAccess(req.user, businessId);
      if (!business) {
        throw new AuthorizationError('You do not have access to this business.');
      }

      req.business = { id: businessId };
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireResourceAccess(resource, options = {}) {
  const {
    source = 'params',
    field = 'id',
    notFoundLabel = resource,
    allowStaff = false,
  } = options;

  return async (req, res, next) => {
    try {
      const resourceId = getSourceObject(req, source)?.[field];
      if (!resourceId) {
        throw new ValidationError(`${field} is required.`);
      }

      const businessId = await resolveBusinessIdForResource(resource, resourceId);
      if (!businessId) {
        throw new NotFoundError(notFoundLabel);
      }

      if (req.user.role === 'staff' && !allowStaff) {
        throw new AuthorizationError(`You do not have access to this ${notFoundLabel}.`);
      }

      const business = await userHasBusinessAccess(req.user, businessId);
      if (!business) {
        throw new AuthorizationError(`You do not have access to this ${notFoundLabel}.`);
      }

      if (req.user.role === 'staff') {
        const allowed = await staffCanAccessResource(req.user, resource, resourceId);
        if (!allowed) {
          throw new AuthorizationError(`You do not have access to this ${notFoundLabel}.`);
        }
      }

      req.business = { id: businessId };
      next();
    } catch (err) {
      next(err);
    }
  };
}

async function validateInternalBusinessToken(businessId, token) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, internal_api_token: true },
  });

  if (!business || !safeTokenMatch(business.internal_api_token, token)) {
    return false;
  }

  return true;
}

function requireInternalBusinessAccess(source = 'query', field = 'business_id') {
  return async (req, res, next) => {
    try {
      const businessId = getSourceObject(req, source)?.[field] || getTokenHeader(req, 'x-business-id');
      const businessToken = getTokenHeader(req, 'x-business-token');

      if (!businessId) {
        throw new ValidationError(`${field} is required.`);
      }
      if (!businessToken) {
        throw new AuthorizationError('Missing x-business-token header.');
      }

      const isValid = await validateInternalBusinessToken(businessId, businessToken);
      if (!isValid) {
        throw new AuthorizationError('Invalid business token.');
      }

      req.internalBusinessId = businessId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireInternalResourceAccess(resource, options = {}) {
  const { source = 'params', field = 'id', notFoundLabel = resource } = options;

  return async (req, res, next) => {
    try {
      const resourceId = getSourceObject(req, source)?.[field];
      const businessToken = getTokenHeader(req, 'x-business-token');

      if (!resourceId) {
        throw new ValidationError(`${field} is required.`);
      }
      if (!businessToken) {
        throw new AuthorizationError('Missing x-business-token header.');
      }

      const businessId = await resolveBusinessIdForResource(resource, resourceId);
      if (!businessId) {
        throw new NotFoundError(notFoundLabel);
      }

      const claimedBusinessId = getTokenHeader(req, 'x-business-id');
      if (claimedBusinessId && claimedBusinessId !== businessId) {
        throw new AuthorizationError('Resource does not belong to the claimed business.');
      }

      const isValid = await validateInternalBusinessToken(businessId, businessToken);
      if (!isValid) {
        throw new AuthorizationError('Invalid business token.');
      }

      req.internalBusinessId = businessId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware to verify internal API key (used by AI Bridge routes).
 */
function requireInternalApiKey(req, res, next) {
  const apiKey = getTokenHeader(req, 'x-api-key');
  const expected = env.INTERNAL_API_KEY || HARDCODED_FALLBACK_API_KEY;

  if (!safeTokenMatch(expected, apiKey)) {
    logger.warn('Unauthorized internal API access attempt', {
      ip: req.ip,
      path: req.originalUrl,
      hasApiKey: Boolean(apiKey),
      internalKeyConfigured: Boolean(env.INTERNAL_API_KEY),
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key.',
    });
  }

  next();
}

/**
 * Middleware to verify JWT token from Authorization header.
 * Attaches decoded user payload to req.user on success.
 *
 * Expected header format: Authorization: Bearer <token>
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  const match = typeof authHeader === 'string'
    ? authHeader.match(/^Bearer\s+(.+)$/i)
    : null;

  if (!match) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    });
  }

  const token = match[1].trim();
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token. Please sign in again.',
    });
  }

  // Attach user info to request for downstream use
  req.user = decoded;
  next();
}

module.exports = {
  requireInternalApiKey,
  requireAuth,
  requireRole,
  requireBusinessAccess,
  requireResourceAccess,
  requireInternalBusinessAccess,
  requireInternalResourceAccess,
};
