/**
 * SMS Controller
 * Handles incoming Twilio webhooks and outbound SMS routing.
 */
const notificationService = require('./notification.service');
const logger = require('../../utils/logger');

/**
 * Twilio webhook handler for incoming SMS.
 * Receives the text, routes it to the AI service, and responds.
 */
async function handleIncomingSms(req, res, next) {
  try {
    const { From, Body } = req.body;
    logger.info(`Incoming SMS from ${From}: ${Body}`);

    // Route to AI service for processing
    const aiResponse = await notificationService.routeToAI(From, Body);

    // Send response back via Twilio TwiML
    res.set('Content-Type', 'text/xml');
    res.send(`
      <Response>
        <Message>${aiResponse}</Message>
      </Response>
    `);
  } catch (err) {
    next(err);
  }
}

/**
 * Send an outbound SMS notification.
 */
async function sendSms(req, res, next) {
  try {
    const { business_id, to, message, customer_id, customer_name, job_id } = req.body;
    const result = await notificationService.sendSms(to, message, { business_id, customer_id, customer_name, job_id });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { handleIncomingSms, sendSms };
