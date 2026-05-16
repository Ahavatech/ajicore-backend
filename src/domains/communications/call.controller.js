/**
 * Call Controller - outbound voice only.
 * Inbound call webhooks are handled by the AI service at api.myajicore.com.
 */
const notificationService = require('./notification.service');

async function makeCall(req, res, next) {
  try {
    const { business_id, to, message, twiml, customer_id, customer_name, job_id } = req.body;
    const result = await notificationService.makeCall(
      to,
      { message, twiml },
      { business_id, customer_id, customer_name, job_id }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { makeCall };
