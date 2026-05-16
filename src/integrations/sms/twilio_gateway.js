/**
 * Twilio communications gateway integration.
 * Wraps Twilio SDK calls for outbound SMS and outbound voice calls.
 */
const logger = require('../../utils/logger');
const {
  getTwilioClient,
  hasTwilioCredentials,
  hasTwilioSmsSender,
  hasTwilioVoiceSender,
  normalizeE164PhoneNumber,
  resolveTwilioSmsSender,
  resolveTwilioVoiceSender,
} = require('../twilio/twilio_client');

/**
 * Send an SMS message.
 * @param {string} to - Recipient phone number (E.164 format).
 * @param {string} body - Message text.
 */
async function sendMessage(to, body, options = {}) {
  if (!hasTwilioCredentials()) {
    throw new Error('Twilio credentials are not configured on this server.');
  }
  if (!hasTwilioSmsSender()) {
    throw new Error('Twilio outbound sender is not configured. Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER.');
  }

  const client = getTwilioClient();
  const payload = {
    body,
    to: normalizeE164PhoneNumber(to, 'to'),
    ...resolveTwilioSmsSender(options.from),
  };

  const message = await client.messages.create(payload);

  logger.info(`SMS sent to ${to}: ${message.sid}`);
  return {
    sid: message.sid,
    status: message.status,
    to: message.to || payload.to,
    from: message.from || payload.from || null,
  };
}

async function makeCall(to, options = {}) {
  if (!hasTwilioCredentials()) {
    throw new Error('Twilio credentials are not configured on this server.');
  }
  if (!hasTwilioVoiceSender()) {
    throw new Error('Twilio voice sender is not configured. Set TWILIO_PHONE_NUMBER to a real Twilio-owned voice number.');
  }

  const client = getTwilioClient();
  const payload = {
    to: normalizeE164PhoneNumber(to, 'to'),
    ...resolveTwilioVoiceSender(options.from),
  };

  if (options.twiml) {
    payload.twiml = options.twiml;
  } else if (options.url) {
    payload.url = options.url;
    payload.method = options.method || 'POST';
  } else {
    throw new Error('Outbound call requires either inline twiml or a voice URL.');
  }

  if (options.statusCallback) {
    payload.statusCallback = options.statusCallback;
    payload.statusCallbackMethod = options.statusCallbackMethod || 'POST';
  }

  if (options.machineDetection) {
    payload.machineDetection = options.machineDetection;
  }

  const call = await client.calls.create(payload);
  logger.info(`Call placed to ${to}: ${call.sid}`);
  return {
    sid: call.sid,
    status: call.status,
    to: call.to || payload.to,
    from: call.from || payload.from,
  };
}

module.exports = { sendMessage, makeCall };
