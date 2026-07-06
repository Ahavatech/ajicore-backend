/**
 * Activity Log Service
 * Normalizes dashboard-facing activity events and writes them safely.
 */
const aiLogService = require('./ai_event_log.service');
const logger = require('../../utils/logger');
const { ValidationError } = require('../../utils/errors');

const ACTIVITY_EVENT_PREFIXES = ['call', 'sms', 'job', 'invoice', 'schedule', 'quote'];

function isSupportedActivityEventType(eventType = '') {
  return ACTIVITY_EVENT_PREFIXES.some((prefix) => eventType.startsWith(`${prefix}.`));
}

function normalizeActivityPayload(data = {}) {
  if (!data.business_id) {
    throw new ValidationError('business_id is required.');
  }

  if (!data.event_type) {
    throw new ValidationError('event_type is required.');
  }

  if (!isSupportedActivityEventType(data.event_type)) {
    throw new ValidationError(`event_type must start with one of: ${ACTIVITY_EVENT_PREFIXES.join(', ')}`);
  }

  const details = {
    ...(data.details && typeof data.details === 'object' ? data.details : {}),
  };

  if (data.title !== undefined) details.title = data.title;
  if (data.message !== undefined) details.message = data.message;
  if (data.location !== undefined) details.location = data.location;
  if (data.reference_id !== undefined) details.reference_id = data.reference_id;

  return {
    business_id: data.business_id,
    event_type: data.event_type,
    timestamp: data.timestamp,
    actor: data.actor || null,
    details: Object.keys(details).length > 0 ? details : null,
    job_id: data.job_id || null,
    customer_id: data.customer_id || null,
    error: data.error || null,
  };
}

async function logActivity(data) {
  return aiLogService.log(normalizeActivityPayload(data));
}

async function logActivitySafe(data) {
  try {
    return await logActivity(data);
  } catch (err) {
    logger.warn('Failed to write activity log', {
      business_id: data?.business_id,
      event_type: data?.event_type,
      error: err.message,
    });
    return null;
  }
}

module.exports = {
  ACTIVITY_EVENT_PREFIXES,
  isSupportedActivityEventType,
  logActivity,
  logActivitySafe,
  normalizeActivityPayload,
};
