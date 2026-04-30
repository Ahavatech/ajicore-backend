/**
 * AI Chat Controller
 * Handles the frontend chat widget endpoint.
 */
const aiChatService = require('./ai_chat.service');

async function chat(req, res, next) {
  try {
    const result = await aiChatService.chat({
      business_id: req.body.business_id,
      message: req.body.message,
      history: req.body.history,
      requestUser: req.user,
    });

    res.json({ reply: result.reply });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  chat,
};
