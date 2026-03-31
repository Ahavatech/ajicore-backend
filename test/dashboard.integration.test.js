const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

process.env.NODE_ENV = 'test';
process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'test-internal-key';

const prisma = new PrismaClient();
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

  const internalEventResponse = await requestJson('/api/internal/events', {
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
  assert.ok(docsResponse.body.paths['/api/internal/events'].post);
});
