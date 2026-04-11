const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'test-internal-key';

const prisma = require('../src/lib/prisma');
const app = require('../src/app');

const DAY_MS = 24 * 60 * 60 * 1000;

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

async function requestJson(path, { method = 'GET', headers = {}, body } = {}) {
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
  const password_hash = await bcrypt.hash('CurrentPass123', 4);
  const owner = await prisma.user.create({
    data: {
      email: `${suffix}@example.com`,
      password_hash,
      onboarding_step: 6,
      onboarding_completed: true,
    },
  });

  const business = await prisma.business.create({
    data: {
      name: `Business ${suffix}`,
      industry: 'HVAC',
      owner_id: owner.id,
      internal_api_token: randomUUID(),
      timezone: 'UTC',
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
  };
}

async function createAuthOnlyUserFixture(t, label) {
  const suffix = `${label}-${randomUUID().slice(0, 8)}`;
  const password_hash = await bcrypt.hash('CurrentPass123', 4);
  const user = await prisma.user.create({
    data: {
      email: `${suffix}@example.com`,
      password_hash,
      onboarding_step: 2,
      onboarding_completed: false,
    },
  });

  t.after(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  return user;
}

async function seedDashboardData(business, options = {}) {
  const currentRevenue = options.currentRevenue ?? 1200;
  const previousRevenue = options.previousRevenue ?? 800;
  const now = new Date();
  const currentTimestamp = new Date(now.getTime() - 2 * DAY_MS);
  const previousTimestamp = new Date(now.getTime() - 9 * DAY_MS);
  const activeScheduledTime = new Date(now.getTime() - 30 * 60 * 1000);
  const tomorrowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const msUntilTomorrow = Math.max(5 * 60 * 1000, tomorrowStart.getTime() - now.getTime());
  const travelOffset = Math.max(5 * 60 * 1000, Math.min(30 * 60 * 1000, Math.floor(msUntilTomorrow / 2)));
  const travelScheduledTime = new Date(now.getTime() + travelOffset);

  const [sarah, bob] = await Promise.all([
    prisma.customer.create({
      data: {
        business_id: business.id,
        first_name: 'Sarah',
        last_name: 'Johnson',
        address: '123 Main St, Dallas TX',
      },
    }),
    prisma.customer.create({
      data: {
        business_id: business.id,
        first_name: 'Chris',
        last_name: 'Parker',
        address: '456 Market St, Dallas TX',
      },
    }),
  ]);

  const [onJobStaff, travelingStaff, breakStaff] = await Promise.all([
    prisma.staff.create({
      data: {
        business_id: business.id,
        name: 'Mike Davis',
        role: 'Technician',
        hourly_rate: 40,
      },
    }),
    prisma.staff.create({
      data: {
        business_id: business.id,
        name: 'Chris Brown',
        role: 'Manager',
        hourly_rate: 55,
      },
    }),
    prisma.staff.create({
      data: {
        business_id: business.id,
        name: 'Taylor Reed',
        role: 'Admin',
        hourly_rate: 30,
      },
    }),
  ]);

  const jobOnSite = await prisma.job.create({
    data: {
      business_id: business.id,
      customer_id: sarah.id,
      assigned_staff_id: onJobStaff.id,
      type: 'Job',
      status: 'InProgress',
      title: 'Leak Fix',
      service_type: 'Plumbing',
      address: '123 Main St, Dallas TX',
      scheduled_start_time: activeScheduledTime,
      actual_start_time: new Date(now.getTime() - 20 * 60 * 1000),
      createdAt: currentTimestamp,
    },
  });

  await prisma.staff.update({
    where: { id: onJobStaff.id },
    data: { active_job_id: jobOnSite.id },
  });

  const [travelJob, completedJob, previousJob] = await Promise.all([
    prisma.job.create({
      data: {
        business_id: business.id,
        customer_id: bob.id,
        assigned_staff_id: travelingStaff.id,
        type: 'Job',
        status: 'Scheduled',
        title: 'Install Visit',
        service_type: 'HVAC',
        address: '456 Market St, Dallas TX',
        scheduled_start_time: travelScheduledTime,
        createdAt: new Date(now.getTime() - DAY_MS),
      },
    }),
    prisma.job.create({
      data: {
        business_id: business.id,
        customer_id: bob.id,
        type: 'Job',
        status: 'Completed',
        title: 'Panel Upgrade',
        service_type: 'Electrical',
        address: '789 Pine St, Dallas TX',
        createdAt: new Date(now.getTime() - 3 * DAY_MS),
      },
    }),
    prisma.job.create({
      data: {
        business_id: business.id,
        customer_id: sarah.id,
        type: 'Job',
        status: 'Completed',
        title: 'Old Job',
        service_type: 'Plumbing',
        address: '321 Cedar St, Dallas TX',
        createdAt: previousTimestamp,
      },
    }),
  ]);

  await prisma.timesheet.create({
    data: {
      staff_id: breakStaff.id,
      clock_in: new Date(now.getTime() - 60 * 60 * 1000),
    },
  });

  const [currentInvoice, overdueInvoice, pendingInvoice, previousInvoice] = await Promise.all([
    prisma.invoice.create({
      data: {
        job_id: jobOnSite.id,
        business_id: business.id,
        status: 'Paid',
        paid_at: currentTimestamp,
        createdAt: currentTimestamp,
      },
    }),
    prisma.invoice.create({
      data: {
        job_id: travelJob.id,
        business_id: business.id,
        status: 'Overdue',
        createdAt: currentTimestamp,
      },
    }),
    prisma.invoice.create({
      data: {
        job_id: completedJob.id,
        business_id: business.id,
        status: 'Sent',
        createdAt: currentTimestamp,
      },
    }),
    prisma.invoice.create({
      data: {
        job_id: previousJob.id,
        business_id: business.id,
        status: 'Paid',
        paid_at: previousTimestamp,
        createdAt: previousTimestamp,
      },
    }),
  ]);

  await prisma.invoiceLine.createMany({
    data: [
      { invoice_id: currentInvoice.id, description: 'Current work', quantity: 1, unit_price: currentRevenue, total: currentRevenue },
      { invoice_id: overdueInvoice.id, description: 'Overdue work', quantity: 1, unit_price: 300, total: 300 },
      { invoice_id: pendingInvoice.id, description: 'Pending work', quantity: 1, unit_price: 250, total: 250 },
      { invoice_id: previousInvoice.id, description: 'Previous work', quantity: 1, unit_price: previousRevenue, total: previousRevenue },
    ],
  });

  await prisma.payment.createMany({
    data: [
      {
        invoice_id: currentInvoice.id,
        amount: currentRevenue,
        payment_method: 'manual',
        paid_at: currentTimestamp,
      },
      {
        invoice_id: previousInvoice.id,
        amount: previousRevenue,
        payment_method: 'manual',
        paid_at: previousTimestamp,
      },
    ],
  });

  await prisma.quote.createMany({
    data: [
      {
        business_id: business.id,
        customer_id: sarah.id,
        status: 'Sent',
        title: 'HVAC Installation',
        createdAt: new Date(now.getTime() - DAY_MS),
      },
      {
        business_id: business.id,
        customer_id: bob.id,
        status: 'Draft',
        title: 'Electrical Inspection',
        createdAt: currentTimestamp,
      },
    ],
  });

  return {
    customer: sarah,
    secondaryCustomer: bob,
    staff: { onJobStaff, travelingStaff, breakStaff },
    jobs: { jobOnSite, travelJob, completedJob, previousJob },
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

test('dashboard summary and revenue return zero-safe defaults for an empty business', async (t) => {
  const fixture = await createBusinessFixture(t, 'empty-dashboard');

  const summaryResponse = await requestJson(`/api/dashboard/summary?business_id=${fixture.business.id}`, {
    headers: { Authorization: `Bearer ${fixture.token}` },
  });

  assert.equal(summaryResponse.status, 200);
  assert.deepEqual(summaryResponse.body, {
    revenue: 0,
    active_jobs: 0,
    jobs_trend: 0,
    pending_invoices: 0,
    overdue_invoices: 0,
    calls_handled: 0,
    todays_jobs: [],
    pending_quotes: [],
    recent_activity: [],
    active_team: [],
  });

  const revenueResponse = await requestJson(`/api/dashboard/revenue?business_id=${fixture.business.id}&period=7d`, {
    headers: { Authorization: `Bearer ${fixture.token}` },
  });

  assert.equal(revenueResponse.status, 200);
  assert.equal(revenueResponse.body.total, 0);
  assert.equal(revenueResponse.body.trend, 0);
  assert.equal(revenueResponse.body.chart_data.length, 7);
  assert.ok(revenueResponse.body.chart_data.every((point) => point.value === 0));
});

test('dashboard revenue and jobs analytics expose frontend-ready chart data', async (t) => {
  const fixture = await createBusinessFixture(t, 'chart-dashboard');
  await seedDashboardData(fixture.business, { currentRevenue: 1200, previousRevenue: 800 });

  const revenueResponse = await requestJson(`/api/dashboard/revenue?business_id=${fixture.business.id}&period=7d`, {
    headers: { Authorization: `Bearer ${fixture.token}` },
  });

  assert.equal(revenueResponse.status, 200);
  assert.equal(revenueResponse.body.total, 1200);
  assert.equal(revenueResponse.body.trend, 50);
  assert.equal(revenueResponse.body.chart_data.length, 7);
  assert.ok(revenueResponse.body.chart_data.some((point) => point.value === 0));

  const analyticsResponse = await requestJson(`/api/dashboard/jobs-analytics?business_id=${fixture.business.id}&period=7d`, {
    headers: { Authorization: `Bearer ${fixture.token}` },
  });

  assert.equal(analyticsResponse.status, 200);
  assert.equal(analyticsResponse.body.period, '7d');
  assert.equal(analyticsResponse.body.total, 3);
  assert.ok(analyticsResponse.body.chart_data.some((point) => point.name === 'Plumbing' && point.value === 1));
  assert.ok(analyticsResponse.body.chart_data.some((point) => point.name === 'HVAC' && point.value === 1));
  assert.ok(analyticsResponse.body.chart_data.some((point) => point.name === 'Electrical' && point.value === 1));
});

test('dashboard summary reflects backend activity logs and internal call events', async (t) => {
  const fixture = await createBusinessFixture(t, 'activity-dashboard');
  const seeded = await seedDashboardData(fixture.business, { currentRevenue: 900, previousRevenue: 450 });

  const quoteCreateResponse = await requestJson('/api/quotes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${fixture.token}` },
    body: {
      business_id: fixture.business.id,
      customer_id: seeded.customer.id,
      title: 'Water Heater Estimate',
      scheduled_estimate_date: new Date().toISOString(),
    },
  });

  assert.equal(quoteCreateResponse.status, 201);

  const internalEventResponse = await requestJson('/api/internal/ai/events', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.INTERNAL_API_KEY,
      'x-business-token': fixture.business.internal_api_token,
    },
    body: {
      business_id: fixture.business.id,
      event_type: 'call.missed',
      title: 'Missed call from Sarah Johnson',
    },
  });

  assert.equal(internalEventResponse.status, 201);

  const summaryResponse = await requestJson(`/api/dashboard/summary?business_id=${fixture.business.id}&period=7d`, {
    headers: { Authorization: `Bearer ${fixture.token}` },
  });

  assert.equal(summaryResponse.status, 200);
  assert.equal(summaryResponse.body.revenue, 900);
  assert.equal(summaryResponse.body.active_jobs, 2);
  assert.equal(summaryResponse.body.pending_invoices, 2);
  assert.equal(summaryResponse.body.overdue_invoices, 1);
  assert.equal(summaryResponse.body.calls_handled, 1);
  assert.ok(summaryResponse.body.todays_jobs.length >= 2);
  assert.ok(summaryResponse.body.pending_quotes.length >= 2);
  assert.ok(summaryResponse.body.active_team.some((member) => member.status === 'On Job'));
  assert.ok(summaryResponse.body.active_team.some((member) => member.status === 'Traveling'));
  assert.ok(summaryResponse.body.active_team.some((member) => member.status === 'On Break'));
  assert.ok(summaryResponse.body.recent_activity.some((item) => item.type === 'call' && item.title === 'Missed call from Sarah Johnson'));
  assert.ok(summaryResponse.body.recent_activity.some((item) => item.type === 'schedule' && item.title.includes('Estimate scheduled for Sarah Johnson')));
});

test('swagger docs expose the updated dashboard and internal activity schemas', async () => {
  const docsResponse = await requestJson('/api/docs.json');

  assert.equal(docsResponse.status, 200);
  assert.ok(docsResponse.body.components.schemas.DashboardSummary);
  assert.ok(docsResponse.body.components.schemas.DashboardRevenue);
  assert.ok(docsResponse.body.components.schemas.DashboardJobsAnalytics);
  assert.ok(docsResponse.body.components.schemas.InternalActivityEventInput);
  assert.equal(
    docsResponse.body.paths['/api/dashboard/summary'].get.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/DashboardSummary'
  );
  assert.ok(docsResponse.body.paths['/api/internal/ai/events'].post);
  assert.ok(docsResponse.body.paths['/api/auth/forgot-password'].post);
  assert.ok(docsResponse.body.paths['/api/business/profile'].get);
  assert.ok(docsResponse.body.paths['/api/conversations'].get);
});

test('auth reset flow verifies codes and allows sign-in with the new password', async (t) => {
  const user = await createAuthOnlyUserFixture(t, 'reset-flow');

  const forgotResponse = await requestJson('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: user.email },
  });

  assert.equal(forgotResponse.status, 200);
  assert.ok(forgotResponse.body.message.includes('If an account exists'));
  assert.ok(forgotResponse.body.dev_reset_code);

  const verifyFailResponse = await requestJson('/api/auth/verify-reset-code', {
    method: 'POST',
    body: { email: user.email, code: '00000' },
  });

  assert.equal(verifyFailResponse.status, 400);

  const verifyResponse = await requestJson('/api/auth/verify-reset-code', {
    method: 'POST',
    body: { email: user.email, code: forgotResponse.body.dev_reset_code },
  });

  assert.equal(verifyResponse.status, 200);
  assert.equal(verifyResponse.body.valid, true);

  const resetResponse = await requestJson('/api/auth/reset-password', {
    method: 'POST',
    body: {
      email: user.email,
      code: forgotResponse.body.dev_reset_code,
      new_password: 'BrandNewPass123',
    },
  });

  assert.equal(resetResponse.status, 200);

  const signinResponse = await requestJson('/api/auth/signin', {
    method: 'POST',
    body: { email: user.email, password: 'BrandNewPass123' },
  });

  assert.equal(signinResponse.status, 200);
  assert.ok(signinResponse.body.token);
});

test('jobs and quotes list endpoints support team filters, search, and date ranges', async (t) => {
  const fixture = await createBusinessFixture(t, 'team-filters');
  const seeded = await seedDashboardData(fixture.business, { currentRevenue: 700, previousRevenue: 500 });
  const futureDate = new Date(Date.now() + 4 * DAY_MS).toISOString();

  const createdJob = await requestJson('/api/jobs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${fixture.token}` },
    body: {
      business_id: fixture.business.id,
      customer_id: seeded.secondaryCustomer.id,
      assigned_staff_id: seeded.staff.travelingStaff.id,
      title: 'Filterable HVAC Job',
      service_type: 'HVAC Tune-Up',
      address: '998 Filter Ave',
      scheduled_start_time: futureDate,
    },
  });

  assert.equal(createdJob.status, 201);

  const createdQuote = await requestJson('/api/quotes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${fixture.token}` },
    body: {
      business_id: fixture.business.id,
      customer_id: seeded.secondaryCustomer.id,
      assigned_staff_id: seeded.staff.travelingStaff.id,
      title: 'Filterable Estimate',
      description: 'Tune-up estimate',
      scheduled_estimate_date: futureDate,
    },
  });

  assert.equal(createdQuote.status, 201);

  const jobsResponse = await requestJson(
    `/api/jobs?business_id=${fixture.business.id}&assigned_staff_id=${seeded.staff.travelingStaff.id}&search=Filterable&start_date=${encodeURIComponent(new Date(Date.now() + 3 * DAY_MS).toISOString())}&end_date=${encodeURIComponent(new Date(Date.now() + 5 * DAY_MS).toISOString())}`,
    {
      headers: { Authorization: `Bearer ${fixture.token}` },
    }
  );

  assert.equal(jobsResponse.status, 200);
  assert.ok(jobsResponse.body.data.some((job) => job.title === 'Filterable HVAC Job'));

  const quotesResponse = await requestJson(
    `/api/quotes?business_id=${fixture.business.id}&assigned_staff_id=${seeded.staff.travelingStaff.id}&search=Filterable&start_date=${encodeURIComponent(new Date(Date.now() + 3 * DAY_MS).toISOString())}&end_date=${encodeURIComponent(new Date(Date.now() + 5 * DAY_MS).toISOString())}`,
    {
      headers: { Authorization: `Bearer ${fixture.token}` },
    }
  );

  assert.equal(quotesResponse.status, 200);
  assert.ok(quotesResponse.body.data.some((quote) => quote.title === 'Filterable Estimate'));
});

test('quotes endpoints support the full authenticated lifecycle', async (t) => {
  const fixture = await createBusinessFixture(t, 'quotes-lifecycle');
  const seeded = await seedDashboardData(fixture.business, { currentRevenue: 450, previousRevenue: 300 });
  const authHeaders = { Authorization: `Bearer ${fixture.token}` };
  const scheduledEstimateDate = new Date(Date.now() + 2 * DAY_MS).toISOString();
  const scheduledJobStart = new Date(Date.now() + 3 * DAY_MS).toISOString();

  const createResponse = await requestJson('/api/quotes', {
    method: 'POST',
    headers: authHeaders,
    body: {
      business_id: fixture.business.id,
      customer_id: seeded.customer.id,
      assigned_staff_id: seeded.staff.travelingStaff.id,
      title: 'Lifecycle Estimate',
      description: 'Initial walkthrough',
      scheduled_estimate_date: scheduledEstimateDate,
    },
  });

  assert.equal(createResponse.status, 201);
  const createdQuoteId = createResponse.body.id;

  const listResponse = await requestJson(`/api/quotes?business_id=${fixture.business.id}&search=Lifecycle`, {
    headers: authHeaders,
  });

  assert.equal(listResponse.status, 200);
  assert.ok(listResponse.body.data.some((quote) => quote.id === createdQuoteId));

  const getResponse = await requestJson(`/api/quotes/${createdQuoteId}`, {
    headers: authHeaders,
  });

  assert.equal(getResponse.status, 200);
  assert.equal(getResponse.body.id, createdQuoteId);

  const updateResponse = await requestJson(`/api/quotes/${createdQuoteId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: {
      status: 'Draft',
      title: 'Lifecycle Estimate Draft',
      total_amount: 325,
      notes: 'Prepared after site visit',
    },
  });

  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.status, 'Draft');
  assert.equal(updateResponse.body.total_amount, 325);

  const sendResponse = await requestJson(`/api/quotes/${createdQuoteId}/send`, {
    method: 'POST',
    headers: authHeaders,
  });

  assert.equal(sendResponse.status, 200);
  assert.equal(sendResponse.body.status, 'Sent');
  assert.ok(sendResponse.body.sent_at);
  assert.ok(sendResponse.body.expires_at);

  const approveResponse = await requestJson(`/api/quotes/${createdQuoteId}/approve`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      assigned_staff_id: seeded.staff.travelingStaff.id,
      title: 'Lifecycle Converted Job',
      job_details: 'Approved by customer',
      scheduled_start_time: scheduledJobStart,
    },
  });

  assert.equal(approveResponse.status, 200);
  assert.equal(approveResponse.body.quote.status, 'Approved');
  assert.equal(approveResponse.body.job.title, 'Lifecycle Converted Job');
  assert.equal(approveResponse.body.job.assigned_staff_id, seeded.staff.travelingStaff.id);

  const declinedQuote = await requestJson('/api/quotes', {
    method: 'POST',
    headers: authHeaders,
    body: {
      business_id: fixture.business.id,
      customer_id: seeded.secondaryCustomer.id,
      title: 'Decline Me',
    },
  });

  assert.equal(declinedQuote.status, 201);

  const declineResponse = await requestJson(`/api/quotes/${declinedQuote.body.id}/decline`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      reason: 'Customer chose another option',
    },
  });

  assert.equal(declineResponse.status, 200);
  assert.equal(declineResponse.body.status, 'Declined');
  assert.match(declineResponse.body.notes, /Customer chose another option/);

  const deletableQuote = await requestJson('/api/quotes', {
    method: 'POST',
    headers: authHeaders,
    body: {
      business_id: fixture.business.id,
      customer_id: seeded.secondaryCustomer.id,
      title: 'Delete Me',
    },
  });

  assert.equal(deletableQuote.status, 201);

  const deleteResponse = await requestJson(`/api/quotes/${deletableQuote.body.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });

  assert.equal(deleteResponse.status, 204);

  const deletedFetchResponse = await requestJson(`/api/quotes/${deletableQuote.body.id}`, {
    headers: authHeaders,
  });

  assert.equal(deletedFetchResponse.status, 404);
});

test('business settings, staff detail, and conversations expose frontend-ready data', async (t) => {
  const fixture = await createBusinessFixture(t, 'settings-convo');
  const seeded = await seedDashboardData(fixture.business, { currentRevenue: 500, previousRevenue: 250 });

  const unauthorizedBusinessProfile = await requestJson(`/api/business/profile?business_id=${fixture.business.id}`);
  assert.equal(unauthorizedBusinessProfile.status, 401);

  const staffUpdateResponse = await requestJson(`/api/staff/${seeded.staff.travelingStaff.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${fixture.token}` },
    body: { check_in_frequency_hours: 2 },
  });

  assert.equal(staffUpdateResponse.status, 200);
  assert.equal(staffUpdateResponse.body.check_in_frequency_hours, 2);

  const staffListResponse = await requestJson(`/api/staff?business_id=${fixture.business.id}`, {
    headers: { Authorization: `Bearer ${fixture.token}` },
  });

  assert.equal(staffListResponse.status, 200);
  assert.ok(staffListResponse.body.some((staff) => staff.has_open_timesheet === true));
  assert.ok(staffListResponse.body.some((staff) => staff.active_job_summary));

  const businessProfileResponse = await requestJson(`/api/business/profile?business_id=${fixture.business.id}`, {
    headers: { Authorization: `Bearer ${fixture.token}` },
  });

  assert.equal(businessProfileResponse.status, 200);
  assert.equal(businessProfileResponse.body.business_id, fixture.business.id);

  const businessAlertsResponse = await requestJson('/api/business/alerts', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${fixture.token}` },
    body: {
      business_id: fixture.business.id,
      settings: {
        missed_calls: false,
        overdue_invoices: true,
      },
    },
  });

  assert.equal(businessAlertsResponse.status, 200);
  assert.equal(businessAlertsResponse.body.settings.missed_calls, false);

  const businessAutomationResponse = await requestJson('/api/business/automation', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${fixture.token}` },
    body: {
      business_id: fixture.business.id,
      payment_interval: 'weekly',
      payment_follow_up_days: ['1', '3'],
      settings: {
        default_check_in_frequency_hours: 3,
      },
    },
  });

  assert.equal(businessAutomationResponse.status, 200);
  assert.equal(businessAutomationResponse.body.settings.payment_interval, 'weekly');
  assert.equal(businessAutomationResponse.body.settings.default_check_in_frequency_hours, 3);

  const businessCommunicationResponse = await requestJson('/api/business/communication', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${fixture.token}` },
    body: {
      business_id: fixture.business.id,
      ai_receptionist_name: 'Aji',
      settings: {
        send_job_updates: false,
      },
    },
  });

  assert.equal(businessCommunicationResponse.status, 200);
  assert.equal(businessCommunicationResponse.body.settings.ai_receptionist_name, 'Aji');
  assert.equal(businessCommunicationResponse.body.settings.send_job_updates, false);

  const callEventResponse = await requestJson('/api/internal/ai/events', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.INTERNAL_API_KEY,
      'x-business-token': fixture.business.internal_api_token,
    },
    body: {
      business_id: fixture.business.id,
      customer_id: seeded.customer.id,
      event_type: 'call.missed',
      title: 'Missed call from Sarah Johnson',
    },
  });

  assert.equal(callEventResponse.status, 201);

  const smsEventResponse = await requestJson('/api/internal/ai/events', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.INTERNAL_API_KEY,
      'x-business-token': fixture.business.internal_api_token,
    },
    body: {
      business_id: fixture.business.id,
      customer_id: seeded.customer.id,
      event_type: 'sms.outbound_sent',
      title: 'Sent appointment confirmation',
    },
  });

  assert.equal(smsEventResponse.status, 201);

  const conversationListResponse = await requestJson(`/api/conversations?business_id=${fixture.business.id}`, {
    headers: { Authorization: `Bearer ${fixture.token}` },
  });

  assert.equal(conversationListResponse.status, 200);
  assert.ok(conversationListResponse.body.data.some((item) => item.customer_id === seeded.customer.id));

  const conversationDetailResponse = await requestJson(
    `/api/conversations/${seeded.customer.id}?business_id=${fixture.business.id}`,
    {
      headers: { Authorization: `Bearer ${fixture.token}` },
    }
  );

  assert.equal(conversationDetailResponse.status, 200);
  assert.ok(conversationDetailResponse.body.entries.some((entry) => entry.event_type === 'call.missed'));
  assert.ok(conversationDetailResponse.body.entries.some((entry) => entry.event_type === 'sms.outbound_sent'));
});
