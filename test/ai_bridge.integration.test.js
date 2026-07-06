const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

process.env.NODE_ENV = 'test';
process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'test-internal-key';

const prisma = new PrismaClient();
const app = require('../src/app');

let server;
let baseUrl;

function buildAuthToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function createHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function request(path, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: createHeaders(headers),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return { status: response.status, body: payload };
}

async function createBusinessFixture(t, label) {
  const suffix = `${label}-${randomUUID().slice(0, 8)}`;
  const numericSeed = randomUUID().replace(/\D/g, '').slice(0, 8).padEnd(8, '1');
  const aiPhoneNumber = `+1555${numericSeed.slice(0, 7)}`;
  const dedicatedPhoneNumber = `+1666${numericSeed.slice(0, 7)}`;
  const owner = await prisma.user.create({
    data: {
      email: `${suffix}@example.com`,
      password_hash: 'hash',
      onboarding_step: 6,
      onboarding_completed: true,
    },
  });

  const business = await prisma.business.create({
    data: {
      name: `AI Business ${suffix}`,
      industry: 'HVAC',
      owner_id: owner.id,
      internal_api_token: randomUUID(),
      timezone: 'UTC',
      ai_phone_number: aiPhoneNumber,
      dedicated_phone_number: dedicatedPhoneNumber,
      ai_receptionist_name: 'Aji',
      voice_gender: 'Female',
      home_base_zip: '75001',
      service_radius_miles: 25,
      cost_per_mile_over_radius: 3,
      business_hours: { monday: ['08:00', '17:00'] },
      service_area_description: 'Dallas Metro',
      payment_follow_up_days: ['1', '3'],
      payment_interval: 'weekly',
      alert_settings: { missed_calls: true },
      automation_settings: {
        quote_follow_ups_enabled: true,
        team_checkins_enabled: true,
        default_check_in_frequency_hours: 2,
      },
      communication_settings: {
        send_booking_confirmations: true,
        send_job_updates: true,
      },
    },
  });

  const customer = await prisma.customer.create({
    data: {
      business_id: business.id,
      first_name: 'Sarah',
      last_name: 'Johnson',
      phone_number: '+15550101010',
      email: 'sarah@example.com',
      address: '123 Main St',
      zip_code: '75001',
    },
  });

  const staff = await prisma.staff.create({
    data: {
      business_id: business.id,
      name: 'Chris Brown',
      role: 'Technician',
      hourly_rate: 45,
      check_in_frequency_hours: 2,
    },
  });

  const job = await prisma.job.create({
    data: {
      business_id: business.id,
      customer_id: customer.id,
      assigned_staff_id: staff.id,
      type: 'Job',
      status: 'Scheduled',
      title: 'Existing Job',
      service_type: 'HVAC',
      address: '123 Main St',
      scheduled_start_time: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const quote = await prisma.quote.create({
    data: {
      business_id: business.id,
      customer_id: customer.id,
      assigned_staff_id: staff.id,
      status: 'Sent',
      title: 'Existing Quote',
      scheduled_estimate_date: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      business_id: business.id,
      job_id: job.id,
      status: 'Sent',
    },
  });

  await prisma.invoiceLine.create({
    data: {
      invoice_id: invoice.id,
      description: 'Existing work',
      quantity: 1,
      unit_price: 250,
      total: 250,
    },
  });

  const followUp = await prisma.followUp.create({
    data: {
      business_id: business.id,
      type: 'Quote',
      reference_id: quote.id,
      customer_id: customer.id,
      scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const teamCheckin = await prisma.teamCheckin.create({
    data: {
      staff_id: staff.id,
      job_id: job.id,
      scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });

  await prisma.aiEventLog.create({
    data: {
      business_id: business.id,
      customer_id: customer.id,
      event_type: 'call.missed',
      details: { title: 'Missed call from Sarah Johnson' },
    },
  });

  t.after(async () => {
    await prisma.business.deleteMany({ where: { id: business.id } });
    await prisma.user.deleteMany({ where: { id: owner.id } });
  });

  return {
    owner,
    business,
    token: buildAuthToken(owner),
    customer,
    staff,
    job,
    quote,
    invoice,
    followUp,
    teamCheckin,
  };
}

test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
});

test('provider-facing inbound SMS and call routes resolve tenant and log events without x-api-key', async (t) => {
  const fixture = await createBusinessFixture(t, 'provider-webhooks');

  const smsResponse = await request('/api/internal/ai/sms/incoming', {
    method: 'POST',
    body: {
      from: fixture.customer.phone_number,
      to: fixture.business.ai_phone_number,
      message: 'Need service help',
    },
  });

  assert.equal(smsResponse.status, 200);
  assert.equal(smsResponse.body.success, true);
  assert.equal(smsResponse.body.business_id, fixture.business.id);

  const callResponse = await request('/api/internal/ai/calls/incoming', {
    method: 'POST',
    body: {
      from: fixture.customer.phone_number,
      to: fixture.business.ai_phone_number,
      call_sid: 'CA123',
      status: 'ringing',
      intent: 'schedule_service',
    },
  });

  assert.equal(callResponse.status, 200);
  assert.equal(callResponse.body.success, true);

  const callStatusResponse = await request('/api/internal/ai/calls/status', {
    method: 'POST',
    body: {
      from: fixture.customer.phone_number,
      to: fixture.business.ai_phone_number,
      call_sid: 'CA123',
      status: 'completed',
      duration_seconds: 120,
      outcome: 'booked',
    },
  });

  assert.equal(callStatusResponse.status, 200);
  assert.equal(callStatusResponse.body.status, 'completed');

  const events = await prisma.aiEventLog.findMany({
    where: { business_id: fixture.business.id },
    select: { event_type: true },
  });

  const eventTypes = events.map((entry) => entry.event_type);
  assert.ok(eventTypes.includes('sms.inbound_received'));
  assert.ok(eventTypes.includes('call.inbound_received'));
  assert.ok(eventTypes.includes('call.status_updated'));
});

test('business discovery routes resolve tenants with x-api-key only', async (t) => {
  const fixture = await createBusinessFixture(t, 'business-discovery');
  const headers = {
    'x-api-key': process.env.INTERNAL_API_KEY,
  };

  const resolverResponse = await request(
    `/api/internal/ai/business-by-phone?phone=${encodeURIComponent(fixture.business.ai_phone_number)}`,
    { headers }
  );

  assert.equal(resolverResponse.status, 200);
  assert.equal(resolverResponse.body.business_id, fixture.business.id);
  assert.equal(resolverResponse.body.internal_api_token, fixture.business.internal_api_token);

  const activeBusinesses = await request('/api/internal/ai/businesses/active', { headers });
  assert.equal(activeBusinesses.status, 200);
  assert.ok(activeBusinesses.body.some((entry) => entry.business_id === fixture.business.id));

  const notFound = await request('/api/internal/ai/business-by-phone?phone=%2B19999999999', { headers });
  assert.equal(notFound.status, 404);
});

test('internal AI bridge wrappers expose business, customer, billing, follow-up, and conversation context', async (t) => {
  const fixture = await createBusinessFixture(t, 'internal-wrappers');
  const headers = {
    'x-api-key': process.env.INTERNAL_API_KEY,
    'x-business-token': fixture.business.internal_api_token,
  };

  const unauthorizedResponse = await request(`/api/internal/ai/jobs?business_id=${fixture.business.id}`);
  assert.equal(unauthorizedResponse.status, 401);

  const businessConfig = await request(`/api/internal/ai/business-config?business_id=${fixture.business.id}`, { headers });
  assert.equal(businessConfig.status, 200);
  assert.equal(businessConfig.body.business.ai_phone_number, fixture.business.ai_phone_number);
  assert.deepEqual(businessConfig.body.business.payment_follow_up_days, ['1', '3']);
  assert.ok(businessConfig.body.business.alert_settings);
  assert.ok(businessConfig.body.business.automation_settings);
  assert.ok(businessConfig.body.business.communication_settings);

  const customerDetail = await request(`/api/internal/ai/customers/${fixture.customer.id}`, { headers });
  assert.equal(customerDetail.status, 200);
  assert.equal(customerDetail.body.id, fixture.customer.id);

  const customerHistory = await request(`/api/internal/ai/customers/${fixture.customer.id}/history`, { headers });
  assert.equal(customerHistory.status, 200);
  assert.ok(Array.isArray(customerHistory.body.jobs));

  const staffList = await request(`/api/internal/ai/staff?business_id=${fixture.business.id}`, { headers });
  assert.equal(staffList.status, 200);
  assert.ok(Array.isArray(staffList.body));

  const quoteDetail = await request(`/api/internal/ai/quotes/${fixture.quote.id}`, { headers });
  assert.equal(quoteDetail.status, 200);
  assert.equal(quoteDetail.body.id, fixture.quote.id);

  const invoiceDetail = await request(`/api/internal/ai/invoices/${fixture.invoice.id}`, { headers });
  assert.equal(invoiceDetail.status, 200);
  assert.equal(invoiceDetail.body.id, fixture.invoice.id);

  const invoiceTotal = await request(`/api/internal/ai/invoices/${fixture.invoice.id}/total`, { headers });
  assert.equal(invoiceTotal.status, 200);
  assert.equal(invoiceTotal.body.subtotal, 250);

  const followUps = await request(`/api/internal/ai/follow-ups?business_id=${fixture.business.id}`, { headers });
  assert.equal(followUps.status, 200);
  assert.ok(followUps.body.data.length >= 1);

  const teamCheckins = await request(`/api/internal/ai/team-checkins?business_id=${fixture.business.id}`, { headers });
  assert.equal(teamCheckins.status, 200);
  assert.ok(teamCheckins.body.data.length >= 1);

  const conversations = await request(`/api/internal/ai/conversations?business_id=${fixture.business.id}`, { headers });
  assert.equal(conversations.status, 200);
  assert.ok(conversations.body.data.some((entry) => entry.customer_id === fixture.customer.id));

  const conversationDetail = await request(`/api/internal/ai/conversations/${fixture.customer.id}`, { headers });
  assert.equal(conversationDetail.status, 200);
  assert.ok(Array.isArray(conversationDetail.body.entries));

  const events = await request(`/api/internal/ai/events?business_id=${fixture.business.id}`, { headers });
  assert.equal(events.status, 200);
  assert.ok(Array.isArray(events.body.data));

  const eventTypes = await request(`/api/internal/ai/events/event-types?business_id=${fixture.business.id}`, { headers });
  assert.equal(eventTypes.status, 200);
  assert.ok(Array.isArray(eventTypes.body.data));

  const businessAutomation = await request(`/api/internal/ai/business/automation?business_id=${fixture.business.id}`, { headers });
  assert.equal(businessAutomation.status, 200);
  assert.equal(businessAutomation.body.business_id, fixture.business.id);
});

test('ai booking and price lookup support richer internal workflows and automation artifacts', async (t) => {
  const fixture = await createBusinessFixture(t, 'ai-booking');
  const headers = {
    'x-api-key': process.env.INTERNAL_API_KEY,
    'x-business-token': fixture.business.internal_api_token,
  };

  const priceBookItem = await prisma.priceBookItem.create({
    data: {
      business_id: fixture.business.id,
      name: 'HVAC Tune-Up',
      description: 'Seasonal tune-up',
      can_quote_phone: true,
      price_type: 'Fixed',
      price: 199,
      visit_type: 'FreeEstimate',
    },
  });

  const priceLookup = await request(
    `/api/internal/ai/price-lookup?business_id=${fixture.business.id}&search=HVAC&can_quote_phone=true&limit=5`,
    { headers }
  );
  assert.equal(priceLookup.status, 200);
  assert.ok(priceLookup.body.items.some((item) => item.id === priceBookItem.id));

  const quoteBooking = await request('/api/internal/ai/book', {
    method: 'POST',
    headers,
    body: {
      business_id: fixture.business.id,
      booking_type: 'Quote',
      customer_id: fixture.customer.id,
      service_name: 'Phone Quote',
      scheduled_start_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      notes: 'Booked from AI',
    },
  });

  assert.equal(quoteBooking.status, 201);
  assert.ok(quoteBooking.body.automation.follow_up);

  const jobBooking = await request('/api/internal/ai/book', {
    method: 'POST',
    headers,
    body: {
      business_id: fixture.business.id,
      booking_type: 'Job',
      customer: {
        first_name: 'New',
        last_name: 'Caller',
        phone_number: '+15550101111',
        email: 'newcaller@example.com',
        address: '456 Elm St',
        zip_code: '75002',
      },
      assigned_staff_id: fixture.staff.id,
      service_name: 'Emergency Visit',
      service_type: 'Emergency HVAC',
      address: '456 Elm St',
      scheduled_start_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      scheduled_end_time: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      is_emergency: true,
    },
  });

  assert.equal(jobBooking.status, 201);
  assert.ok(jobBooking.body.automation.team_checkin);
  assert.equal(jobBooking.body.result.service_type, 'Emergency HVAC');
  assert.equal(jobBooking.body.result.address, '456 Elm St');
});

test('internal quote endpoints support the full AI bridge lifecycle', async (t) => {
  const fixture = await createBusinessFixture(t, 'internal-quote-lifecycle');
  const headers = {
    'x-api-key': process.env.INTERNAL_API_KEY,
    'x-business-token': fixture.business.internal_api_token,
  };
  const scheduledEstimateDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const scheduledJobStart = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  const createResponse = await request('/api/internal/ai/quotes', {
    method: 'POST',
    headers,
    body: {
      business_id: fixture.business.id,
      customer_id: fixture.customer.id,
      assigned_staff_id: fixture.staff.id,
      title: 'Internal Lifecycle Quote',
      description: 'Created from AI bridge',
      scheduled_estimate_date: scheduledEstimateDate,
    },
  });

  assert.equal(createResponse.status, 201);
  const quoteId = createResponse.body.id;

  const listResponse = await request(`/api/internal/ai/quotes?business_id=${fixture.business.id}&search=Internal%20Lifecycle`, {
    headers,
  });

  assert.equal(listResponse.status, 200);
  assert.ok(listResponse.body.data.some((quote) => quote.id === quoteId));

  const getResponse = await request(`/api/internal/ai/quotes/${quoteId}`, { headers });
  assert.equal(getResponse.status, 200);
  assert.equal(getResponse.body.id, quoteId);

  const updateResponse = await request(`/api/internal/ai/quotes/${quoteId}`, {
    method: 'PATCH',
    headers,
    body: {
      status: 'Draft',
      total_amount: 499,
      notes: 'Prepared for approval',
    },
  });

  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.status, 'Draft');
  assert.equal(updateResponse.body.total_amount, 499);

  const sendResponse = await request(`/api/internal/ai/quotes/${quoteId}/send`, {
    method: 'POST',
    headers,
  });

  assert.equal(sendResponse.status, 200);
  assert.equal(sendResponse.body.status, 'Sent');
  assert.ok(sendResponse.body.expires_at);

  const approveResponse = await request(`/api/internal/ai/quotes/${quoteId}/approve`, {
    method: 'POST',
    headers,
    body: {
      assigned_staff_id: fixture.staff.id,
      title: 'Internal Converted Job',
      job_details: 'Converted from AI approval',
      scheduled_start_time: scheduledJobStart,
    },
  });

  assert.equal(approveResponse.status, 200);
  assert.equal(approveResponse.body.quote.status, 'Approved');
  assert.equal(approveResponse.body.job.title, 'Internal Converted Job');

  const declinedQuote = await request('/api/internal/ai/quotes', {
    method: 'POST',
    headers,
    body: {
      business_id: fixture.business.id,
      customer_id: fixture.customer.id,
      title: 'Internal Decline',
    },
  });

  assert.equal(declinedQuote.status, 201);

  const declineResponse = await request(`/api/internal/ai/quotes/${declinedQuote.body.id}/decline`, {
    method: 'POST',
    headers,
    body: {
      reason: 'Customer declined over phone',
    },
  });

  assert.equal(declineResponse.status, 200);
  assert.equal(declineResponse.body.status, 'Declined');
});
