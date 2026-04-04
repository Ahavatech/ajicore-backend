const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const customerService = require('../customers/customer.service');
const notificationService = require('./notification.service');
const { logActivitySafe } = require('../ai_logs/activity_log.service');
const { NotFoundError, ValidationError } = require('../../utils/errors');

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function extractValue(source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && String(source[key]).trim() !== '') {
      return source[key];
    }
  }
  return null;
}

async function resolveBusinessByDestination(destination) {
  const normalizedDestination = normalizePhone(destination);
  if (!normalizedDestination) {
    throw new ValidationError('Destination phone number is required.');
  }

  const candidates = await prisma.business.findMany({
    where: {
      OR: [
        { ai_phone_number: { not: null } },
        { dedicated_phone_number: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      ai_phone_number: true,
      dedicated_phone_number: true,
      internal_api_token: true,
    },
  });

  const business = candidates.find((candidate) => {
    const aiPhone = normalizePhone(candidate.ai_phone_number);
    const dedicatedPhone = normalizePhone(candidate.dedicated_phone_number);
    return aiPhone === normalizedDestination || dedicatedPhone === normalizedDestination;
  });

  if (!business) {
    throw new NotFoundError('Business');
  }

  return business;
}

async function findOrCreateInboundCustomer(businessId, phoneNumber) {
  if (!phoneNumber) return null;

  const customer = await customerService.findByPhone(businessId, phoneNumber);
  if (customer) return customer;

  return customerService.create({
    business_id: businessId,
    first_name: 'Inbound',
    last_name: 'Customer',
    phone_number: phoneNumber,
  });
}

async function handleInboundSms(body = {}) {
  const from = extractValue(body, ['From', 'from']);
  const to = extractValue(body, ['To', 'to']);
  const message = extractValue(body, ['Body', 'body', 'message', 'text']);

  if (!from || !to || !message) {
    throw new ValidationError('From, To, and Body are required.');
  }

  const business = await resolveBusinessByDestination(to);
  const customer = await findOrCreateInboundCustomer(business.id, from);

  await logActivitySafe({
    business_id: business.id,
    customer_id: customer?.id || null,
    event_type: 'sms.inbound_received',
    title: `Inbound SMS from ${customer?.name || from}`,
    details: {
      from,
      to,
      body: message,
    },
  });

  const aiReply = await notificationService.routeToAI(from, message, {
    business_id: business.id,
    customer_id: customer?.id || null,
    customer_name: customer?.name || null,
    to,
  });

  return {
    business,
    customer,
    ai_reply: aiReply,
    channel: 'sms',
  };
}

async function handleInboundCall(body = {}) {
  const from = extractValue(body, ['From', 'from']);
  const to = extractValue(body, ['To', 'to']);
  const callSid = extractValue(body, ['CallSid', 'call_sid', 'callSid']);
  const status = extractValue(body, ['CallStatus', 'status']);
  const transcript = extractValue(body, ['transcript', 'Transcript']);
  const recordingUrl = extractValue(body, ['RecordingUrl', 'recording_url']);
  const duration = extractValue(body, ['CallDuration', 'duration_seconds']);
  const intent = extractValue(body, ['intent', 'Intent']);
  const outcome = extractValue(body, ['outcome', 'Outcome']);

  if (!from || !to) {
    throw new ValidationError('From and To are required.');
  }

  const business = await resolveBusinessByDestination(to);
  const customer = await findOrCreateInboundCustomer(business.id, from);

  await logActivitySafe({
    business_id: business.id,
    customer_id: customer?.id || null,
    event_type: 'call.inbound_received',
    title: `Inbound call from ${customer?.name || from}`,
    details: {
      from,
      to,
      call_sid: callSid,
      status,
      intent,
      transcript,
      recording_url: recordingUrl,
      duration_seconds: duration ? Number(duration) : null,
      outcome,
    },
  });

  const aiResponse = await notificationService.routeCallToAI({
    business_id: business.id,
    customer_id: customer?.id || null,
    customer_name: customer?.name || null,
    from,
    to,
    call_sid: callSid,
    status,
    transcript,
    recording_url: recordingUrl,
    duration_seconds: duration ? Number(duration) : null,
    intent,
    outcome,
  });

  return {
    business,
    customer,
    ai_response: aiResponse,
    channel: 'call',
  };
}

async function handleCallStatus(body = {}) {
  const to = extractValue(body, ['To', 'to']);
  const from = extractValue(body, ['From', 'from']);
  const callSid = extractValue(body, ['CallSid', 'call_sid', 'callSid']);
  const status = extractValue(body, ['CallStatus', 'status']);
  const transcript = extractValue(body, ['transcript', 'Transcript']);
  const recordingUrl = extractValue(body, ['RecordingUrl', 'recording_url']);
  const duration = extractValue(body, ['CallDuration', 'duration_seconds']);
  const intent = extractValue(body, ['intent', 'Intent']);
  const outcome = extractValue(body, ['outcome', 'Outcome']);

  if (!to || !status) {
    throw new ValidationError('To and status are required.');
  }

  const business = await resolveBusinessByDestination(to);
  const customer = from ? await findOrCreateInboundCustomer(business.id, from) : null;

  await logActivitySafe({
    business_id: business.id,
    customer_id: customer?.id || null,
    event_type: 'call.status_updated',
    title: `Call status updated to ${status}`,
    details: {
      from,
      to,
      call_sid: callSid,
      status,
      intent,
      transcript,
      recording_url: recordingUrl,
      duration_seconds: duration ? Number(duration) : null,
      outcome,
    },
  });

  return {
    business,
    customer,
    status,
    call_sid: callSid,
  };
}

module.exports = {
  handleInboundSms,
  handleInboundCall,
  handleCallStatus,
  resolveBusinessByDestination,
  findOrCreateInboundCustomer,
};
