const env = require('../../config/env');
const { ValidationError } = require('../../utils/errors');
const logger = require('../../utils/logger');

function looksLikeApiKey(sid) {
  return /^SK[a-zA-Z0-9]+$/.test(String(sid || '').trim());
}

function looksLikeAccountSid(sid) {
  return /^AC[a-zA-Z0-9]+$/.test(String(sid || '').trim());
}

function getTwilioCredentials() {
  const accountSidRaw = String(env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = env.TWILIO_AUTH_TOKEN;
  const apiKeySid = String(env.TWILIO_API_KEY_SID || '').trim();
  const apiKeySecret = env.TWILIO_API_KEY_SECRET;

  if (apiKeySid && apiKeySecret && looksLikeAccountSid(accountSidRaw)) {
    return { sid: apiKeySid, secret: apiKeySecret, accountSid: accountSidRaw };
  }

  if (looksLikeApiKey(accountSidRaw) && authToken && looksLikeAccountSid(apiKeySid)) {
    return { sid: accountSidRaw, secret: authToken, accountSid: apiKeySid };
  }

  if (looksLikeAccountSid(accountSidRaw) && authToken) {
    return { sid: accountSidRaw, secret: authToken };
  }

  if (!accountSidRaw && !apiKeySid) {
    throw new ValidationError('Twilio credentials are not configured.');
  }

  throw new ValidationError(
    'Twilio credentials are misconfigured. Set either '
    + '(TWILIO_ACCOUNT_SID=AC... + TWILIO_AUTH_TOKEN) or '
    + '(TWILIO_API_KEY_SID=SK... + TWILIO_API_KEY_SECRET + TWILIO_ACCOUNT_SID=AC...).'
  );
}

function hasTwilioCredentials() {
  try {
    getTwilioCredentials();
    return true;
  } catch (_err) {
    return false;
  }
}

function getTwilioClient() {
  const credentials = getTwilioCredentials();

  try {
    const twilio = require('twilio');
    if (credentials.accountSid) {
      return twilio(credentials.sid, credentials.secret, { accountSid: credentials.accountSid });
    }
    return twilio(credentials.sid, credentials.secret);
  } catch (err) {
    logger.error(`Twilio SDK load failed: ${err.code || 'UNKNOWN'} ${err.message}`, {
      stack: err.stack,
    });
    throw new ValidationError(`Twilio SDK load failed: ${err.code || err.message}`);
  }
}

function normalizeE164PhoneNumber(phoneNumber, fieldName = 'phone_number') {
  const normalized = String(phoneNumber || '').trim();
  if (!/^\+\d{8,15}$/.test(normalized)) {
    throw new ValidationError(`${fieldName} must be a valid E.164 phone number.`);
  }
  return normalized;
}

function hasTwilioSmsSender() {
  return Boolean(env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_PHONE_NUMBER);
}

function hasTwilioVoiceSender() {
  return Boolean(env.TWILIO_PHONE_NUMBER);
}

function isPlaceholderTwilioPhoneNumber(value) {
  const normalized = String(value || '').trim();
  return !normalized || normalized === '+1234567890' || normalized === '+10000000000';
}

function validateTwilioPhoneNumberSetting(value, fieldName = 'TWILIO_PHONE_NUMBER') {
  const normalized = normalizeE164PhoneNumber(value, fieldName);
  if (isPlaceholderTwilioPhoneNumber(normalized)) {
    throw new ValidationError(`${fieldName} must be set to a real Twilio-owned phone number.`);
  }
  return normalized;
}

function resolveTwilioSmsSender(fromPhoneNumber) {
  if (env.TWILIO_MESSAGING_SERVICE_SID) {
    return { messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID };
  }

  const candidate = fromPhoneNumber || env.TWILIO_PHONE_NUMBER;
  return { from: validateTwilioPhoneNumberSetting(candidate, fromPhoneNumber ? 'from' : 'TWILIO_PHONE_NUMBER') };
}

function resolveTwilioVoiceSender(fromPhoneNumber) {
  const candidate = fromPhoneNumber || env.TWILIO_PHONE_NUMBER;
  return { from: validateTwilioPhoneNumberSetting(candidate, fromPhoneNumber ? 'from' : 'TWILIO_PHONE_NUMBER') };
}

module.exports = {
  getTwilioClient,
  getTwilioCredentials,
  hasTwilioCredentials,
  hasTwilioSmsSender,
  hasTwilioVoiceSender,
  normalizeE164PhoneNumber,
  validateTwilioPhoneNumberSetting,
  resolveTwilioSmsSender,
  resolveTwilioVoiceSender,
};
