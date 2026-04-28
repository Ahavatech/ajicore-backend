/**
 * Notification Service
 * Manages outbound notifications (SMS, email) and AI routing.
 */
const twilioGateway = require('../../integrations/sms/twilio_gateway');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { logActivitySafe } = require('../ai_logs/activity_log.service');

async function sendSms(to, message, context = {}) {
  try {
    const result = await twilioGateway.sendMessage(to, message);

    if (context.business_id) {
      await logActivitySafe({
        business_id: context.business_id,
        customer_id: context.customer_id || null,
        job_id: context.job_id || null,
        event_type: 'sms.outbound_sent',
        title: `SMS sent to ${context.customer_name || to}`,
        details: {
          to,
          sid: result.sid,
          status: result.status,
        },
      });
    }

    return result;
  } catch (err) {
    if (context.business_id) {
      await logActivitySafe({
        business_id: context.business_id,
        customer_id: context.customer_id || null,
        job_id: context.job_id || null,
        event_type: 'sms.outbound_failed',
        title: `SMS failed to ${context.customer_name || to}`,
        error: err.message,
        details: { to },
      });
    }

    throw err;
  }
}

/**
 * Route an incoming SMS to the AI service for processing.
 */
async function routeToAI(fromNumber, messageBody, context = {}) {
  try {
    const response = await fetch(`${env.AI_SERVICE_URL}/api/sms/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.INTERNAL_API_KEY,
      },
      body: JSON.stringify({ from: fromNumber, message: messageBody, context }),
    });

    if (!response.ok) throw new Error(`AI service status ${response.status}`);
    const data = await response.json();
    return data.reply || 'Sorry, I could not process your request at this time.';
  } catch (err) {
    logger.error('Failed to route SMS to AI service', { error: err.message });
    return 'Our system is temporarily unavailable. Please try again later.';
  }
}

/**
 * Route an incoming call event to the AI service.
 */
async function routeCallToAI(payload) {
  try {
    const response = await fetch(`${env.AI_SERVICE_URL}/api/call/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.INTERNAL_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`AI call service status ${response.status}`);
    return await response.json();
  } catch (err) {
    logger.error('Failed to route call to AI service', { error: err.message });
    return { action: 'transfer', message: 'Service unavailable' };
  }
}

/**
 * Send invoice payment reminder.
 */
async function sendPaymentReminder(phoneNumber, customerName, invoiceId, amount) {
  const message = `Hi ${customerName}, you have an outstanding invoice of $${amount}. Reply PAID or call us to settle. Ref: ${invoiceId.slice(0, 8)}`;
  return sendSms(phoneNumber, message, { customer_name: customerName });
}

module.exports = { sendSms, routeToAI, routeCallToAI, sendPaymentReminder };
