/**
 * Notification Service
 * Manages outbound notifications (SMS, email) and AI routing.
 */
const twilioGateway = require('../../integrations/sms/twilio_gateway');
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
 * Send invoice payment reminder.
 */
async function sendPaymentReminder(phoneNumber, customerName, invoiceId, amount) {
  const message = `Hi ${customerName}, you have an outstanding invoice of $${amount}. Reply PAID or call us to settle. Ref: ${invoiceId.slice(0, 8)}`;
  return sendSms(phoneNumber, message, { customer_name: customerName });
}

module.exports = { sendSms, sendPaymentReminder };
