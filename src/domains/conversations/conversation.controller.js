const service = require('./conversation.service');

// ─────────────────────────────────────────────────────────────────────────────
// Public reads (dashboard) — auth via user JWT + tenant guard upstream
// ─────────────────────────────────────────────────────────────────────────────

async function list(req, res, next) {
  try {
    const result = await service.listConversations({
      business_id: req.query.business_id,
      channel:     req.query.channel,
      customer_id: req.query.customer_id,
      search:      req.query.search,
      from:        req.query.from,
      to:          req.query.to,
      page:        req.query.page,
      limit:       req.query.limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const result = await service.getConversation({
      business_id: req.query.business_id,
      id:          req.params.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// Backwards-compat: the previous conversation route was scoped by customer_id
// and returned a custom aggregate shape. Some frontend callers may still hit
// /api/conversations/{customer_id}. Keep it working by listing all
// conversations for that customer.
async function showByCustomer(req, res, next) {
  try {
    const result = await service.listConversations({
      business_id: req.query.business_id,
      channel:     req.query.channel,
      customer_id: req.params.customer_id,
      page:        1,
      limit:       100,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal writes (AI service) — auth via internal API key upstream
// ─────────────────────────────────────────────────────────────────────────────

async function startInternal(req, res, next) {
  try {
    const out = await service.startConversation({
      business_id:  req.body.business_id,
      channel:      req.body.channel,
      external_id:  req.body.external_id,
      customer_id:  req.body.customer_id,
      caller_phone: req.body.caller_phone,
      caller_name:  req.body.caller_name,
      meta:         req.body.meta,
    });
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
}

async function appendInternal(req, res, next) {
  try {
    const out = await service.appendMessage({
      business_id:     req.body.business_id,
      conversation_id: req.params.id,
      turn_index:      req.body.turn_index,
      role:            req.body.role,
      text:            req.body.text,
      latency_ms:      req.body.latency_ms,
      model:           req.body.model,
      tokens_in:       req.body.tokens_in,
      tokens_out:      req.body.tokens_out,
      twilio_sid:      req.body.twilio_sid,
      audio_url:       req.body.audio_url,
      meta:            req.body.meta,
    });
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
}

async function finalizeInternal(req, res, next) {
  try {
    const out = await service.finalizeConversation({
      business_id:       req.body.business_id,
      id:                req.params.id,
      status:            req.body.status,
      outcome:           req.body.outcome,
      intent:            req.body.intent,
      job_id:            req.body.job_id,
      quote_id:          req.body.quote_id,
      escalated:         req.body.escalated,
      escalation_reason: req.body.escalation_reason,
      threat_level:      req.body.threat_level,
      duration_seconds:  req.body.duration_seconds,
      audio_url:         req.body.audio_url,
      customer_id:       req.body.customer_id,
      ended_at:          req.body.ended_at,
      meta:              req.body.meta,
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  show,
  showByCustomer,
  startInternal,
  appendInternal,
  finalizeInternal,
};
