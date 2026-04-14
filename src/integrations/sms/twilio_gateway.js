/**
 * Twilio SMS Gateway Integration
 * Wraps Twilio SDK calls for sending and receiving SMS.
 */
const env = require('../../config/env');
const logger = require('../../utils/logger');

// Lazy-load Twilio to avoid crashes if the package isn't installed yet
let twilioClient = null;

function getTwilio() {
  if (!twilioClient) {
    try {
      const twilio = require('twilio');
      twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    } catch (err) {
      logger.warn('Twilio SDK not installed. SMS features will be unavailable.');
      return null;
    }
  }
  return twilioClient;
}

/**
 * Send an SMS message.
 * @param {string} to - Recipient phone number (E.164 format).
 * @param {string} body - Message text.
 */
async function sendMessage(to, body) {
  const client = getTwilio();
  if (!client) {
    throw new Error('Twilio is not configured. Install twilio package and set credentials.');
  }

  const payload = { body, to };
  if (env.TWILIO_MESSAGING_SERVICE_SID) {
    payload.messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
  } else if (env.TWILIO_PHONE_NUMBER) {
    payload.from = env.TWILIO_PHONE_NUMBER;
  } else {
    throw new Error('Twilio outbound sender is not configured. Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER.');
  }

  const message = await client.messages.create(payload);

  logger.info(`SMS sent to ${to}: ${message.sid}`);
  return { sid: message.sid, status: message.status };
}

module.exports = { sendMessage };
