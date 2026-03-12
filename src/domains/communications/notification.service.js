/**
 * Notification Service
 * Manages outbound notifications (SMS, email) and AI routing.
 */
const twilioGateway = require('../../integrations/sms/twilio_gateway');
const env = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Send an SMS message via Twilio.
 */
async function sendSms(to, message) {
  return twilioGateway.sendMessage(to, message);
}

/**
 * Route an incoming SMS to the AI service for processing.
 * @param {string} fromNumber - The sender's phone number.
 * @param {string} messageBody - The SMS text content.
 * @returns {string} The AI-generated response text.
 */
async function routeToAI(fromNumber, messageBody) {
  try {
    const response = await fetch(`${env.AI_SERVICE_URL}/api/sms/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.AI_SERVICE_API_KEY,
      },
      body: JSON.stringify({ from: fromNumber, message: messageBody }),
    });

    if (!response.ok) {
      throw new Error(`AI service responded with status ${response.status}`);
    }

    const data = await response.json();
    return data.reply || 'Sorry, I could not process your request at this time.';
  } catch (err) {
    logger.error('Failed to route SMS to AI service', { error: err.message });
    return 'Our system is temporarily unavailable. Please try again later.';
  }
}

module.exports = { sendSms, routeToAI };