/**
 * Validation Middleware
 * Robust request validation helpers.
 */

/**
 * Validates that required fields exist in req.body and are not empty.
 * Supports nested object validation with dot notation (e.g., 'user.name').
 * @param {string[]} fields - Array of required field names.
 * @param {string|Object} sourceOrOptions - Source ('body', 'query', 'params') or options object
 * @param {Object} options - Validation options (if source is provided as first param)
 * @param {boolean} options.allowEmptyStrings - Allow empty strings as valid (default: false)
 */
function requireFields(fields, sourceOrOptions = {}, options = {}) {
  let source = 'body';
  let validationOptions = {};

  if (typeof sourceOrOptions === 'string') {
    source = sourceOrOptions;
    validationOptions = options;
  } else {
    validationOptions = sourceOrOptions;
  }

  const { allowEmptyStrings = false } = validationOptions;

  return (req, res, next) => {
    const sourceObj = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
    const missing = [];
    const invalid = [];

    for (const field of fields) {
      const value = getNestedValue(sourceObj, field);

      if (value === undefined || value === null) {
        missing.push(field);
      } else if (typeof value === 'string' && !allowEmptyStrings && value.trim() === '') {
        invalid.push(`${field} cannot be empty`);
      }
    }

    if (missing.length > 0 || invalid.length > 0) {
      const errors = [];
      if (missing.length > 0) {
        errors.push(`Missing required fields: ${missing.join(', ')}`);
      }
      if (invalid.length > 0) {
        errors.push(invalid.join(', '));
      }

      return res.status(400).json({
        error: 'Validation Error',
        message: errors.join('; '),
      });
    }

    next();
  };
}

/**
 * Validates that a UUID parameter is properly formatted.
 * @param {string} paramName - The URL parameter name to validate.
 */
function validateUUID(paramName) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return (req, res, next) => {
    const value = req.params[paramName];
    if (!value || !uuidRegex.test(value)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid UUID format for parameter: ${paramName}`,
      });
    }
    next();
  };
}

/**
 * Validates email format.
 * @param {string} fieldName - The field name in req.body to validate.
 */
function validateEmail(fieldName) {
  // RFC 5322 compliant regex (simplified safe version)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  return (req, res, next) => {
    const value = req.body[fieldName];
    if (value) {
      if (!emailRegex.test(value)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Invalid email format for field: ${fieldName}`,
        });
      }
      if (value.length > 254) {  // RFC 5321 limit
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Email address too long',
        });
      }
    }
    next();
  };
}

/**
 * Validates phone number format (basic US format).
 * @param {string} fieldName - The field name in req.body to validate.
 */
function validatePhone(fieldName) {
  const phoneRegex = /^\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;

  return (req, res, next) => {
    const value = req.body[fieldName];
    if (value && !phoneRegex.test(value)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid phone format for field: ${fieldName}`,
      });
    }
    next();
  };
}

/**
 * Validates numeric range.
 * @param {string} fieldName - The field name in req.body to validate.
 * @param {Object} options - min, max values
 */
function validateNumeric(fieldName, options = {}) {
  const { min, max } = options;

  return (req, res, next) => {
    const value = req.body[fieldName];
    if (value !== undefined && value !== null) {
      const num = Number(value);
      if (isNaN(num)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `${fieldName} must be a valid number`,
        });
      }
      if (min !== undefined && num < min) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `${fieldName} must be at least ${min}`,
        });
      }
      if (max !== undefined && num > max) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `${fieldName} must be at most ${max}`,
        });
      }
    }
    next();
  };
}

/**
 * Validates string length.
 * @param {string} fieldName - The field name in req.body to validate.
 * @param {Object} options - minLength, maxLength
 */
function validateStringLength(fieldName, options = {}) {
  const { minLength, maxLength } = options;

  return (req, res, next) => {
    const value = req.body[fieldName];
    if (value !== undefined && value !== null) {
      const str = String(value);
      if (minLength !== undefined && str.length < minLength) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `${fieldName} must be at least ${minLength} characters`,
        });
      }
      if (maxLength !== undefined && str.length > maxLength) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `${fieldName} must be at most ${maxLength} characters`,
        });
      }
    }
    next();
  };
}

/**
 * Validates enum values.
 * @param {string} fieldName - The field name in req.body to validate.
 * @param {string[]} allowedValues - Array of allowed values.
 */
function validateEnum(fieldName, allowedValues) {
  return (req, res, next) => {
    const value = req.body[fieldName];
    if (value !== undefined && value !== null && !allowedValues.includes(value)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      });
    }
    next();
  };
}

/**
 * Helper function to get nested object values using dot notation.
 * @param {Object} obj - The object to traverse.
 * @param {string} path - Dot-separated path (e.g., 'user.address.street').
 * @returns {*} The value at the path, or undefined if not found.
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current && current[key], obj);
}

module.exports = {
  requireFields,
  validateUUID,
  validateEmail,
  validatePhone,
  validateNumeric,
  validateStringLength,
  validateEnum,
};