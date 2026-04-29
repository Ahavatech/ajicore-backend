/**
 * SMS Controller — outbound SMS only.
 * Inbound SMS is handled by the AI service at api.myajicore.com.
 */
const notificationService = require('./notification.service');

async function sendSms(req, res, next) {
  try {
    const { business_id, to, message, customer_id, customer_name, job_id } = req.body;
    const result = await notificationService.sendSms(to, message, { business_id, customer_id, customer_name, job_id });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { sendSms };
