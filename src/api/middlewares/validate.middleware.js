/**
 * Validation Middleware
 * Lightweight request validation helpers.
 * Can be extended with a library like Joi or Zod.
 */

/**
 * Validates that required fields exist in req.body.
 * @param {string[]} fields - Array of required field names.
 */
function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter((field) => {
      const value = req.body[field];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Missing required fields: ${missing.join(', ')}`,
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

module.exports = { requireFields, validateUUID };