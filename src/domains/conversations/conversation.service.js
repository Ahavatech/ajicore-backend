/**
 * Conversation service.
 *
 * Backs the real conversations + conversation_messages tables (Prisma).
 * Replaces the earlier ai_event_logs shim that tried to fake conversations
 * by event_type prefix.
 *
 * Two surfaces:
 *   1. Public reads (dashboard) — list + detail
 *   2. Internal writes (AI service) — start / append / finalize
 */

const prisma = require('../../lib/prisma');
const { NotFoundError, ValidationError } = require('../../utils/errors');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildCustomerName(customer) {
  if (!customer) return null;
  const fullName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fullName || null;
}

function normalizeChannel(channel) {
  if (!channel) return null;
  const c = String(channel).toLowerCase();
  if (c === 'call')  return 'Call';
  if (c === 'sms')   return 'Sms';
  if (c === 'web')   return 'Web';
  return null;
}

function normalizeStatus(status) {
  if (!status) return null;
  const valid = ['InProgress', 'Completed', 'Escalated', 'Failed', 'Abandoned'];
  return valid.includes(status) ? status : null;
}

function normalizeRole(role) {
  if (!role) return null;
  const valid = ['caller', 'agent', 'system', 'tool'];
  return valid.includes(role) ? role : null;
}

// Serialize a conversation row for the public API (drops business_id,
// normalizes nested customer).
function serializeConversation(conv) {
  if (!conv) return null;
  return {
    id:               conv.id,
    channel:          conv.channel.toLowerCase(),
    external_id:      conv.external_id,
    customer_id:      conv.customer_id,
    customer:         conv.customer
      ? {
          id:           conv.customer.id,
          name:         buildCustomerName(conv.customer),
          phone_number: conv.customer.phone_number || null,
          email:        conv.customer.email || null,
        }
      : null,
    caller_phone:     conv.caller_phone,
    caller_name:      conv.caller_name,
    started_at:       conv.started_at,
    ended_at:         conv.ended_at,
    duration_seconds: conv.duration_seconds,
    status:           conv.status,
    outcome:          conv.outcome,
    intent:           conv.intent,
    job_id:           conv.job_id,
    quote_id:         conv.quote_id,
    escalated:        conv.escalated,
    escalation_reason: conv.escalation_reason,
    threat_level:     conv.threat_level,
    message_count:    conv.message_count,
    audio_url:        conv.audio_url,
    meta:             conv.meta,
  };
}

function serializeMessage(msg) {
  if (!msg) return null;
  return {
    id:           msg.id,
    turn_index:   msg.turn_index,
    role:         msg.role,
    text:         msg.text,
    audio_url:    msg.audio_url,
    twilio_sid:   msg.twilio_sid,
    latency_ms:   msg.latency_ms,
    model:        msg.model,
    tokens_in:    msg.tokens_in,
    tokens_out:   msg.tokens_out,
    meta:         msg.meta,
    createdAt:    msg.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC READ — list + detail
// ─────────────────────────────────────────────────────────────────────────────

async function listConversations({
  business_id,
  channel,
  customer_id,
  search,
  from,
  to,
  page = 1,
  limit = 20,
}) {
  if (!business_id) throw new ValidationError('business_id is required');

  const parsedPage  = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const where = { business_id };

  const ch = normalizeChannel(channel);
  if (ch) where.channel = ch;

  if (customer_id) where.customer_id = customer_id;

  if (from || to) {
    where.started_at = {};
    if (from) where.started_at.gte = new Date(from);
    if (to)   where.started_at.lte = new Date(to);
  }

  if (search) {
    const trimmed = String(search).trim();
    if (trimmed) {
      where.OR = [
        { caller_name:  { contains: trimmed, mode: 'insensitive' } },
        { caller_phone: { contains: trimmed,                    } },
        { intent:       { contains: trimmed, mode: 'insensitive' } },
        { outcome:      { contains: trimmed, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { first_name:   { contains: trimmed, mode: 'insensitive' } },
              { last_name:    { contains: trimmed, mode: 'insensitive' } },
              { phone_number: { contains: trimmed } },
              { email:        { contains: trimmed, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }
  }

  const [total, rows] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      orderBy: { started_at: 'desc' },
      skip:    (parsedPage - 1) * parsedLimit,
      take:    parsedLimit,
      include: {
        customer: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            phone_number: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    data:       rows.map(serializeConversation),
    total,
    page:       parsedPage,
    limit:      parsedLimit,
    totalPages: Math.ceil(total / parsedLimit) || 1,
  };
}

async function getConversation({ business_id, id }) {
  if (!business_id) throw new ValidationError('business_id is required');
  if (!id)          throw new ValidationError('conversation id is required');

  const conv = await prisma.conversation.findFirst({
    where: { id, business_id },
    include: {
      customer: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          email: true,
        },
      },
      messages: {
        orderBy: { turn_index: 'asc' },
      },
    },
  });

  if (!conv) throw new NotFoundError('Conversation');

  return {
    ...serializeConversation(conv),
    messages: conv.messages.map(serializeMessage),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL WRITE — AI service surface
// ─────────────────────────────────────────────────────────────────────────────

async function startConversation({
  business_id,
  channel,
  external_id,
  customer_id,
  caller_phone,
  caller_name,
  meta,
}) {
  if (!business_id) throw new ValidationError('business_id is required');
  const ch = normalizeChannel(channel);
  if (!ch) throw new ValidationError('channel must be one of: call, sms, web');

  // Dedupe: if we already have a conversation for this external_id (e.g.
  // Twilio webhook retry within the call), return the existing one rather
  // than creating a duplicate row.
  if (external_id) {
    const existing = await prisma.conversation.findFirst({
      where: { business_id, channel: ch, external_id },
    });
    if (existing) return serializeConversation(existing);
  }

  const conv = await prisma.conversation.create({
    data: {
      business_id,
      channel:      ch,
      external_id:  external_id || null,
      customer_id:  customer_id || null,
      caller_phone: caller_phone || null,
      caller_name:  caller_name || null,
      meta:         meta || undefined,
    },
  });

  return serializeConversation(conv);
}

async function appendMessage({
  business_id,
  conversation_id,
  turn_index,
  role,
  text,
  latency_ms,
  model,
  tokens_in,
  tokens_out,
  twilio_sid,
  audio_url,
  meta,
}) {
  if (!business_id)     throw new ValidationError('business_id is required');
  if (!conversation_id) throw new ValidationError('conversation_id is required');
  if (typeof turn_index !== 'number' || turn_index < 0) {
    throw new ValidationError('turn_index must be a non-negative integer');
  }
  const r = normalizeRole(role);
  if (!r) throw new ValidationError('role must be one of: caller, agent, system, tool');
  if (typeof text !== 'string') throw new ValidationError('text is required');

  // Confirm conversation belongs to this tenant before write.
  const conv = await prisma.conversation.findFirst({
    where:  { id: conversation_id, business_id },
    select: { id: true },
  });
  if (!conv) throw new NotFoundError('Conversation');

  // Idempotent on (conversation_id, turn_index). Twilio webhook retries
  // can re-publish the same turn; upserting prevents duplicate rows.
  const msg = await prisma.conversationMessage.upsert({
    where: {
      conversation_id_turn_index: { conversation_id, turn_index },
    },
    create: {
      conversation_id,
      business_id,
      turn_index,
      role:        r,
      text,
      latency_ms:  latency_ms ?? null,
      model:       model || null,
      tokens_in:   tokens_in ?? null,
      tokens_out:  tokens_out ?? null,
      twilio_sid:  twilio_sid || null,
      audio_url:   audio_url || null,
      meta:        meta || undefined,
    },
    update: {
      text,
      latency_ms:  latency_ms ?? null,
      model:       model || null,
      tokens_in:   tokens_in ?? null,
      tokens_out:  tokens_out ?? null,
      twilio_sid:  twilio_sid || null,
      audio_url:   audio_url || null,
      meta:        meta || undefined,
    },
  });

  // Recompute message_count from the source of truth so we never drift.
  const count = await prisma.conversationMessage.count({
    where: { conversation_id },
  });
  await prisma.conversation.update({
    where: { id: conversation_id },
    data:  { message_count: count },
  });

  return serializeMessage(msg);
}

async function finalizeConversation({
  business_id,
  id,
  status,
  outcome,
  intent,
  job_id,
  quote_id,
  escalated,
  escalation_reason,
  threat_level,
  duration_seconds,
  audio_url,
  customer_id,
  ended_at,
  meta,
}) {
  if (!business_id) throw new ValidationError('business_id is required');
  if (!id)          throw new ValidationError('conversation id is required');

  const conv = await prisma.conversation.findFirst({
    where: { id, business_id }, select: { id: true },
  });
  if (!conv) throw new NotFoundError('Conversation');

  const data = {};
  const s = normalizeStatus(status);
  if (s) data.status = s;
  else data.status = 'Completed';
  if (outcome !== undefined)           data.outcome           = outcome;
  if (intent !== undefined)            data.intent            = intent;
  if (job_id !== undefined)            data.job_id            = job_id;
  if (quote_id !== undefined)          data.quote_id          = quote_id;
  if (escalated !== undefined)         data.escalated         = !!escalated;
  if (escalation_reason !== undefined) data.escalation_reason = escalation_reason;
  if (threat_level !== undefined)      data.threat_level      = threat_level;
  if (duration_seconds !== undefined)  data.duration_seconds  = duration_seconds;
  if (audio_url !== undefined)         data.audio_url         = audio_url;
  if (customer_id !== undefined)       data.customer_id       = customer_id;
  if (meta !== undefined)              data.meta              = meta;
  data.ended_at = ended_at ? new Date(ended_at) : new Date();

  const updated = await prisma.conversation.update({
    where: { id },
    data,
  });

  return serializeConversation(updated);
}

module.exports = {
  // public reads
  listConversations,
  getConversation,
  // internal writes
  startConversation,
  appendMessage,
  finalizeConversation,
};
