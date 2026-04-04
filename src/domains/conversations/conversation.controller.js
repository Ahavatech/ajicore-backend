const conversationService = require('./conversation.service');

async function list(req, res, next) {
  try {
    const result = await conversationService.listConversations(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const result = await conversationService.getConversationByCustomer({
      business_id: req.query.business_id,
      customer_id: req.params.customer_id,
      channel: req.query.channel,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  show,
};
