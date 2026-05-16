/**
 * Notification Service
 * Manages outbound notifications (SMS, email) and AI routing.
 */
const twilioGateway = require('../../integrations/sms/twilio_gateway');
const prisma = require('../../lib/prisma');
const { logActivitySafe } = require('../ai_logs/activity_log.service');

async function resolveBusinessVoiceContext(businessId) {
  if (!businessId) return null;
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      ai_phone_number: true,
    },
  });
}

async function sendSms(to, message, context = {}) {
  try {
    const business = await resolveBusinessVoiceContext(context.business_id);
    const result = await twilioGateway.sendMessage(to, message, {
      from: business?.ai_phone_number || null,
    });

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

function escapeTwiml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildOutboundCallTwiml(message) {
  const safeMessage = escapeTwiml(message || 'Hello from Ajicore. This is a test call confirming your Twilio voice setup is working.');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="1"/><Say voice="alice">${safeMessage}</Say></Response>`;
}

async function makeCall(to, options = {}, context = {}) {
  try {
    const business = await resolveBusinessVoiceContext(context.business_id);
    const result = await twilioGateway.makeCall(to, {
      from: options.from || business?.ai_phone_number || null,
      twiml: options.twiml || buildOutboundCallTwiml(options.message),
      statusCallback: options.statusCallback || null,
      statusCallbackMethod: options.statusCallbackMethod || 'POST',
    });

    if (context.business_id) {
      await logActivitySafe({
        business_id: context.business_id,
        customer_id: context.customer_id || null,
        job_id: context.job_id || null,
        event_type: 'call.outbound_started',
        title: `Call placed to ${context.customer_name || to}`,
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
        event_type: 'call.outbound_failed',
        title: `Call failed to ${context.customer_name || to}`,
        error: err.message,
        details: { to },
      });
    }

    throw err;
  }
}

/**
 * Send invoice payment reminder.
 */
async function sendPaymentReminder(phoneNumber, customerName, invoiceId, amount) {
  const message = `Hi ${customerName}, you have an outstanding invoice of $${amount}. Reply PAID or call us to settle. Ref: ${invoiceId.slice(0, 8)}`;
  return sendSms(phoneNumber, message, { customer_name: customerName });
}

module.exports = { sendSms, makeCall, sendPaymentReminder, buildOutboundCallTwiml };
