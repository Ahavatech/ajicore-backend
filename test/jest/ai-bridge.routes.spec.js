const { BUSINESS_ID, VALID_UUID, createRouteHarness } = require('./helpers/routeHarness');

const jobControllerPath = 'src/domains/jobs/job.controller.js';
const quoteControllerPath = 'src/domains/quotes/quote.controller.js';
const materialControllerPath = 'src/domains/inventory/material.controller.js';
const customerControllerPath = 'src/domains/customers/customer.controller.js';
const smsControllerPath = 'src/domains/communications/sms.controller.js';
const staffControllerPath = 'src/domains/team/staff.controller.js';
const billingControllerPath = 'src/domains/billing/invoice.controller.js';
const followUpControllerPath = 'src/domains/follow_ups/follow_up.controller.js';
const teamCheckinControllerPath = 'src/domains/team_checkins/team_checkin.controller.js';
const pricebookControllerPath = 'src/domains/pricebook/pricebook.controller.js';
const businessControllerPath = 'src/domains/business/business.controller.js';
const conversationsControllerPath = 'src/domains/conversations/conversation.controller.js';
const aiLogsControllerPath = 'src/domains/ai_logs/ai_event_log.controller.js';

const aiIngressMock = {
  handleInboundSms: jest.fn(),
  handleInboundCall: jest.fn(),
  handleCallStatus: jest.fn(),
};

const pbServiceMock = { lookupForAI: jest.fn() };
const quoteServiceMock = { create: jest.fn() };
const jobServiceMock = { createJob: jest.fn() };
const customerServiceMock = { findByPhone: jest.fn(), create: jest.fn() };
const dashboardServiceMock = { getDashboardSummary: jest.fn() };
const activityLogMock = { logActivity: jest.fn() };
const loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const prismaMock = {
  business: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  serviceCategory: { findMany: jest.fn() },
  priceBookItem: { findMany: jest.fn() },
  followUp: { create: jest.fn() },
  teamCheckin: { create: jest.fn() },
};

const harness = createRouteHarness({
  routeModulePath: 'src/api/routes/ai_bridge.routes.js',
  basePath: '/api/internal',
  controllerModules: [
    { modulePath: jobControllerPath, handlers: ['getSchedule', 'getAllJobs', 'getJobById', 'createJob', 'updateJob', 'startJob', 'completeJob', 'checkAvailability'] },
    { modulePath: quoteControllerPath, handlers: ['getAll', 'getById', 'create', 'update', 'sendQuote', 'approve', 'decline'] },
    { modulePath: materialControllerPath, handlers: ['getAllMaterials'] },
    { modulePath: customerControllerPath, handlers: ['getAll', 'findByPhone', 'getById', 'getHistory', 'create'] },
    { modulePath: smsControllerPath, handlers: ['sendSms'] },
    { modulePath: staffControllerPath, handlers: ['getAllStaff', 'getStaffById'] },
    { modulePath: billingControllerPath, handlers: ['getAll', 'getTotal', 'getById', 'createInvoice', 'updateInvoice', 'sendInvoice', 'voidInvoice', 'refundInvoice', 'processPayment'] },
    { modulePath: followUpControllerPath, handlers: ['list', 'create', 'update', 'markSent', 'cancel'] },
    { modulePath: teamCheckinControllerPath, handlers: ['list', 'create', 'update', 'receive', 'escalate'] },
    { modulePath: pricebookControllerPath, handlers: ['getItems', 'getItemById'] },
    { modulePath: businessControllerPath, handlers: ['getProfile', 'getAlerts', 'getAutomation', 'getCommunication'] },
    { modulePath: conversationsControllerPath, handlers: ['list', 'show'] },
    { modulePath: aiLogsControllerPath, handlers: ['eventTypes', 'list'] },
  ],
  extraMocks: [
    { modulePath: 'src/domains/communications/ai_ingress.service.js', factory: () => aiIngressMock },
    { modulePath: 'src/domains/pricebook/pricebook.service.js', factory: () => pbServiceMock },
    { modulePath: 'src/domains/quotes/quote.service.js', factory: () => quoteServiceMock },
    { modulePath: 'src/domains/jobs/job.service.js', factory: () => jobServiceMock },
    { modulePath: 'src/domains/customers/customer.service.js', factory: () => customerServiceMock },
    { modulePath: 'src/domains/dashboard/dashboard.service.js', factory: () => dashboardServiceMock },
    { modulePath: 'src/domains/ai_logs/activity_log.service.js', factory: () => activityLogMock },
    { modulePath: 'src/utils/logger.js', factory: () => loggerMock },
    { modulePath: 'src/lib/prisma.js', factory: () => prismaMock },
  ],
});

const protectedRoutes = [
  { paths: ['/api/internal/ai/schedule', '/api/internal/schedule'], query: { business_id: BUSINESS_ID }, handler: 'getSchedule', modulePath: jobControllerPath },
  { paths: ['/api/internal/ai/jobs', '/api/internal/jobs'], query: { business_id: BUSINESS_ID }, handler: 'getAllJobs', modulePath: jobControllerPath, invalidQuery: {} },
  { paths: [`/api/internal/ai/jobs/${VALID_UUID}`, `/api/internal/jobs/${VALID_UUID}`], handler: 'getJobById', modulePath: jobControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: ['/api/internal/ai/jobs', '/api/internal/jobs'], method: 'post', body: { business_id: BUSINESS_ID, customer_id: VALID_UUID }, handler: 'createJob', modulePath: jobControllerPath, invalidBody: { business_id: BUSINESS_ID } },
  { paths: [`/api/internal/ai/jobs/${VALID_UUID}`, `/api/internal/jobs/${VALID_UUID}`], method: 'patch', body: { title: 'Updated job' }, handler: 'updateJob', modulePath: jobControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/jobs/${VALID_UUID}/start`, `/api/internal/jobs/${VALID_UUID}/start`], method: 'post', handler: 'startJob', modulePath: jobControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/jobs/${VALID_UUID}/complete`, `/api/internal/jobs/${VALID_UUID}/complete`], method: 'post', handler: 'completeJob', modulePath: jobControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: ['/api/internal/ai/staff', '/api/internal/staff'], query: { business_id: BUSINESS_ID }, handler: 'getAllStaff', modulePath: staffControllerPath, invalidQuery: {} },
  { paths: ['/api/internal/ai/staff/availability', '/api/internal/staff/availability'], query: { staff_id: VALID_UUID, start_time: '2026-04-05T10:00:00.000Z', end_time: '2026-04-05T11:00:00.000Z' }, handler: 'checkAvailability', modulePath: jobControllerPath, invalidQuery: { staff_id: VALID_UUID, start_time: '2026-04-05T10:00:00.000Z' } },
  { paths: [`/api/internal/ai/staff/${VALID_UUID}`, `/api/internal/staff/${VALID_UUID}`], handler: 'getStaffById', modulePath: staffControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: ['/api/internal/ai/quotes', '/api/internal/quotes'], query: { business_id: BUSINESS_ID }, handler: 'getAll', modulePath: quoteControllerPath, invalidQuery: {} },
  { paths: [`/api/internal/ai/quotes/${VALID_UUID}`, `/api/internal/quotes/${VALID_UUID}`], handler: 'getById', modulePath: quoteControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: ['/api/internal/ai/quotes', '/api/internal/quotes'], method: 'post', body: { business_id: BUSINESS_ID, customer_id: VALID_UUID }, handler: 'create', modulePath: quoteControllerPath, invalidBody: { business_id: BUSINESS_ID } },
  { paths: [`/api/internal/ai/quotes/${VALID_UUID}`, `/api/internal/quotes/${VALID_UUID}`], method: 'patch', body: { status: 'Draft' }, handler: 'update', modulePath: quoteControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/quotes/${VALID_UUID}/send`, `/api/internal/quotes/${VALID_UUID}/send`], method: 'post', handler: 'sendQuote', modulePath: quoteControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/quotes/${VALID_UUID}/approve`, `/api/internal/quotes/${VALID_UUID}/approve`], method: 'post', body: { title: 'Approved' }, handler: 'approve', modulePath: quoteControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/quotes/${VALID_UUID}/decline`, `/api/internal/quotes/${VALID_UUID}/decline`], method: 'post', body: { reason: 'No thanks' }, handler: 'decline', modulePath: quoteControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: ['/api/internal/ai/customers', '/api/internal/customers'], query: { business_id: BUSINESS_ID }, handler: 'getAll', modulePath: customerControllerPath, invalidQuery: {} },
  { paths: ['/api/internal/ai/customers/lookup', '/api/internal/customers/lookup'], query: { business_id: BUSINESS_ID, phone: '+15555550123' }, handler: 'findByPhone', modulePath: customerControllerPath, invalidQuery: { business_id: BUSINESS_ID } },
  { paths: [`/api/internal/ai/customers/${VALID_UUID}`, `/api/internal/customers/${VALID_UUID}`], handler: 'getById', modulePath: customerControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/customers/${VALID_UUID}/history`, `/api/internal/customers/${VALID_UUID}/history`], handler: 'getHistory', modulePath: customerControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: ['/api/internal/ai/customers', '/api/internal/customers'], method: 'post', body: { business_id: BUSINESS_ID, first_name: 'Aji', last_name: 'Core' }, handler: 'create', modulePath: customerControllerPath, invalidBody: { business_id: BUSINESS_ID, first_name: 'Aji' } },
  { paths: ['/api/internal/ai/inventory', '/api/internal/inventory'], query: { business_id: BUSINESS_ID }, handler: 'getAllMaterials', modulePath: materialControllerPath, invalidQuery: {} },
  { paths: ['/api/internal/ai/price-book', '/api/internal/price-book'], query: { business_id: BUSINESS_ID }, handler: 'getItems', modulePath: pricebookControllerPath, invalidQuery: {} },
  { paths: [`/api/internal/ai/price-book/${VALID_UUID}`, `/api/internal/price-book/${VALID_UUID}`], handler: 'getItemById', modulePath: pricebookControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: ['/api/internal/ai/invoices', '/api/internal/invoices'], query: { business_id: BUSINESS_ID }, handler: 'getAll', modulePath: billingControllerPath, invalidQuery: {} },
  { paths: [`/api/internal/ai/invoices/${VALID_UUID}/total`, `/api/internal/invoices/${VALID_UUID}/total`], handler: 'getTotal', modulePath: billingControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/invoices/${VALID_UUID}`, `/api/internal/invoices/${VALID_UUID}`], handler: 'getById', modulePath: billingControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: ['/api/internal/ai/invoices', '/api/internal/invoices'], method: 'post', body: { business_id: BUSINESS_ID, job_id: VALID_UUID }, handler: 'createInvoice', modulePath: billingControllerPath, invalidBody: { business_id: BUSINESS_ID } },
  { paths: [`/api/internal/ai/invoices/${VALID_UUID}`, `/api/internal/invoices/${VALID_UUID}`], method: 'patch', body: { status: 'Sent' }, handler: 'updateInvoice', modulePath: billingControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/invoices/${VALID_UUID}/send`, `/api/internal/invoices/${VALID_UUID}/send`], method: 'post', handler: 'sendInvoice', modulePath: billingControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/invoices/${VALID_UUID}/void`, `/api/internal/invoices/${VALID_UUID}/void`], method: 'post', handler: 'voidInvoice', modulePath: billingControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/invoices/${VALID_UUID}/refund`, `/api/internal/invoices/${VALID_UUID}/refund`], method: 'post', handler: 'refundInvoice', modulePath: billingControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/payments/${VALID_UUID}`, `/api/internal/payments/${VALID_UUID}`], method: 'post', body: { amount: 100 }, handler: 'processPayment', modulePath: billingControllerPath, invalidBody: {}, failureAuth: 'requireInternalResourceAccess' },
  { paths: ['/api/internal/ai/follow-ups', '/api/internal/follow-ups'], query: { business_id: BUSINESS_ID }, handler: 'list', modulePath: followUpControllerPath, invalidQuery: {} },
  { paths: ['/api/internal/ai/follow-ups', '/api/internal/follow-ups'], method: 'post', body: { business_id: BUSINESS_ID }, handler: 'create', modulePath: followUpControllerPath, invalidBody: {} },
  { paths: [`/api/internal/ai/follow-ups/${VALID_UUID}`, `/api/internal/follow-ups/${VALID_UUID}`], method: 'patch', body: { status: 'Sent' }, handler: 'update', modulePath: followUpControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/follow-ups/${VALID_UUID}/sent`, `/api/internal/follow-ups/${VALID_UUID}/sent`], method: 'post', handler: 'markSent', modulePath: followUpControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/follow-ups/${VALID_UUID}/cancel`, `/api/internal/follow-ups/${VALID_UUID}/cancel`], method: 'post', handler: 'cancel', modulePath: followUpControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: ['/api/internal/ai/team-checkins', '/api/internal/team-checkins'], query: { business_id: BUSINESS_ID }, handler: 'list', modulePath: teamCheckinControllerPath, invalidQuery: {} },
  { paths: ['/api/internal/ai/team-checkins', '/api/internal/team-checkins'], method: 'post', body: { staff_id: VALID_UUID, scheduled_at: '2026-04-05T10:00:00.000Z' }, handler: 'create', modulePath: teamCheckinControllerPath, invalidBody: { staff_id: VALID_UUID } },
  { paths: [`/api/internal/ai/team-checkins/${VALID_UUID}`, `/api/internal/team-checkins/${VALID_UUID}`], method: 'patch', body: { status: 'Received' }, handler: 'update', modulePath: teamCheckinControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/team-checkins/${VALID_UUID}/receive`, `/api/internal/team-checkins/${VALID_UUID}/receive`], method: 'post', handler: 'receive', modulePath: teamCheckinControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: [`/api/internal/ai/team-checkins/${VALID_UUID}/escalate`, `/api/internal/team-checkins/${VALID_UUID}/escalate`], method: 'post', handler: 'escalate', modulePath: teamCheckinControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: ['/api/internal/ai/events/event-types', '/api/internal/events/event-types'], query: { business_id: BUSINESS_ID }, handler: 'eventTypes', modulePath: aiLogsControllerPath, invalidQuery: {} },
  { paths: ['/api/internal/ai/events', '/api/internal/events'], query: { business_id: BUSINESS_ID }, handler: 'list', modulePath: aiLogsControllerPath, invalidQuery: {} },
  { paths: ['/api/internal/ai/conversations', '/api/internal/conversations'], query: { business_id: BUSINESS_ID }, handler: 'list', modulePath: conversationsControllerPath, invalidQuery: {} },
  { paths: [`/api/internal/ai/conversations/${VALID_UUID}`, `/api/internal/conversations/${VALID_UUID}`], handler: 'show', modulePath: conversationsControllerPath, failureAuth: 'requireInternalResourceAccess' },
  { paths: ['/api/internal/ai/business/profile', '/api/internal/business/profile'], query: { business_id: BUSINESS_ID }, handler: 'getProfile', modulePath: businessControllerPath, invalidQuery: {} },
  { paths: ['/api/internal/ai/business/alerts', '/api/internal/business/alerts'], query: { business_id: BUSINESS_ID }, handler: 'getAlerts', modulePath: businessControllerPath, invalidQuery: {} },
  { paths: ['/api/internal/ai/business/automation', '/api/internal/business/automation'], query: { business_id: BUSINESS_ID }, handler: 'getAutomation', modulePath: businessControllerPath, invalidQuery: {} },
  { paths: ['/api/internal/ai/business/communication', '/api/internal/business/communication'], query: { business_id: BUSINESS_ID }, handler: 'getCommunication', modulePath: businessControllerPath, invalidQuery: {} },
  { paths: ['/api/internal/ai/sms/send', '/api/internal/sms/send'], method: 'post', body: { business_id: BUSINESS_ID, to: '+15555550123', message: 'Hello' }, handler: 'sendSms', modulePath: smsControllerPath, invalidBody: { business_id: BUSINESS_ID, to: '+15555550123' } },
];

describe('ai bridge routes', () => {
  beforeAll(async () => {
    await harness.start();
  });

  afterAll(async () => {
    await harness.stop();
  });

  beforeEach(() => {
    harness.authState.fail = null;
    harness.authState.status = 403;
    harness.authState.message = '';
    jest.clearAllMocks();

    aiIngressMock.handleInboundSms.mockResolvedValue({
      business: { id: BUSINESS_ID },
      customer: { id: VALID_UUID },
      ai_reply: 'Thanks for reaching out',
    });
    aiIngressMock.handleInboundCall.mockResolvedValue({
      business: { id: BUSINESS_ID },
      customer: { id: VALID_UUID },
      ai_response: { message: 'We can help' },
    });
    aiIngressMock.handleCallStatus.mockResolvedValue({
      business: { id: BUSINESS_ID },
      customer: { id: VALID_UUID },
      status: 'completed',
      call_sid: 'CA123',
    });

    dashboardServiceMock.getDashboardSummary.mockResolvedValue({ revenue: 100, active_jobs: 2 });
    activityLogMock.logActivity.mockResolvedValue({ id: 'log-1', event_type: 'call.missed' });
    pbServiceMock.lookupForAI.mockResolvedValue([{ id: 'price-1' }]);
    quoteServiceMock.create.mockResolvedValue({ id: 'quote-1', assigned_staff_id: VALID_UUID });
    jobServiceMock.createJob.mockResolvedValue({ id: 'job-1', assigned_staff_id: VALID_UUID });
    customerServiceMock.findByPhone.mockResolvedValue(null);
    customerServiceMock.create.mockResolvedValue({ id: 'customer-1' });
    prismaMock.followUp.create.mockResolvedValue({ id: 'follow-up-1' });
    prismaMock.teamCheckin.create.mockResolvedValue({ id: 'checkin-1' });
    prismaMock.business.findFirst.mockResolvedValue({
      id: BUSINESS_ID,
      name: 'Ajicore',
      ai_phone_number: '+15551234567',
      internal_api_token: 'biz-token-123',
    });
    prismaMock.business.findMany.mockResolvedValue([
      {
        id: BUSINESS_ID,
        ai_phone_number: '+15551234567',
        internal_api_token: 'biz-token-123',
      },
    ]);
    prismaMock.business.findUnique.mockResolvedValue({
      id: BUSINESS_ID,
      name: 'Ajicore',
      service_radius_miles: 25,
      cost_per_mile_over_radius: 3,
      home_base_zip: '75001',
      unknown_service_handling: 'manual_review',
      unknown_service_call_fee: 99,
      automation_settings: { quote_follow_ups_enabled: true, team_checkins_enabled: true, default_check_in_frequency_hours: 2 },
    });
    prismaMock.serviceCategory.findMany.mockResolvedValue([{ id: 'cat-1' }]);
    prismaMock.priceBookItem.findMany.mockResolvedValue([{ id: 'item-1' }]);
  });

  test('provider inbound SMS returns JSON success', async () => {
    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/ai/sms/incoming',
      body: { from: '+15555550123', to: '+16665550123', message: 'Need help' },
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(aiIngressMock.handleInboundSms).toHaveBeenCalledTimes(1);
  });

  test('provider inbound SMS returns Twilio XML for webhook-shaped payloads', async () => {
    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/sms/incoming',
      body: { Body: 'Need help', From: '+15555550123', To: '+16665550123' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain('<Response>');
  });

  test('provider inbound SMS surfaces handler failures', async () => {
    aiIngressMock.handleInboundSms.mockRejectedValueOnce(new Error('sms failed'));

    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/ai/sms/incoming',
      body: { from: '+15555550123', to: '+16665550123', message: 'Need help' },
    });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('sms failed');
  });

  test('provider inbound call returns JSON success', async () => {
    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/ai/calls/incoming',
      body: { from: '+15555550123', to: '+16665550123', status: 'ringing' },
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('provider inbound call returns Twilio XML when Twilio fields are present', async () => {
    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/calls/incoming',
      body: { CallSid: 'CA123', From: '+15555550123', To: '+16665550123' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain('<Say>');
  });

  test('provider call status returns success payload', async () => {
    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/ai/calls/status',
      body: { from: '+15555550123', to: '+16665550123', status: 'completed' },
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('completed');
  });

  test('business-by-phone resolves a tenant with x-api-key only', async () => {
    harness.authState.fail = 'requireInternalBusinessAccess';

    const response = await harness.request({
      path: '/api/internal/ai/business-by-phone',
      query: { phone: '+15551234567' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      business_id: BUSINESS_ID,
      ai_phone_number: '+15551234567',
      name: 'Ajicore',
      internal_api_token: 'biz-token-123',
    });
    expect(prismaMock.business.findFirst).toHaveBeenCalledTimes(1);
  });

  test('business-by-phone returns 404 for unknown phone', async () => {
    prismaMock.business.findFirst.mockResolvedValueOnce(null);

    const response = await harness.request({
      path: '/api/internal/ai/business-by-phone',
      query: { phone: '+15550000000' },
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('no business owns this number');
  });

  test('business-by-phone still requires x-api-key', async () => {
    harness.authState.fail = 'requireInternalApiKey';
    harness.authState.status = 401;

    const response = await harness.request({
      path: '/api/internal/ai/business-by-phone',
      query: { phone: '+15551234567' },
    });

    expect(response.status).toBe(401);
  });

  test('business-by-phone validates E.164 input', async () => {
    const response = await harness.request({
      path: '/api/internal/ai/business-by-phone',
      query: { phone: 'abc' },
    });

    expect(response.status).toBe(400);
  });

  test('active businesses returns scheduler payload with x-api-key only', async () => {
    harness.authState.fail = 'requireInternalBusinessAccess';

    const response = await harness.request({
      path: '/api/internal/ai/businesses/active',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        business_id: BUSINESS_ID,
        ai_phone_number: '+15551234567',
        internal_api_token: 'biz-token-123',
      },
    ]);
  });

  test.each(protectedRoutes)('$paths.0 success on both aliases', async (routeConfig) => {
    for (const routePath of routeConfig.paths) {
      const response = await harness.request({
        method: (routeConfig.method || 'get').toUpperCase(),
        path: routePath,
        query: routeConfig.query,
        body: routeConfig.body,
      });

      expect(response.status).toBe(200);
    }

    expect(harness.controllerHandlers[routeConfig.modulePath][routeConfig.handler]).toHaveBeenCalledTimes(routeConfig.paths.length);
  });

  test.each(protectedRoutes)('$paths.0 failure', async (routeConfig) => {
    if (routeConfig.invalidBody !== undefined || routeConfig.invalidQuery !== undefined) {
      const response = await harness.request({
        method: (routeConfig.method || 'get').toUpperCase(),
        path: routeConfig.paths[0],
        query: routeConfig.invalidQuery !== undefined ? routeConfig.invalidQuery : routeConfig.query,
        body: routeConfig.invalidBody !== undefined ? routeConfig.invalidBody : routeConfig.body,
      });

      expect(response.status).toBe(400);
      return;
    }

    harness.authState.fail = routeConfig.failureAuth || 'requireInternalApiKey';
    harness.authState.status = 401;

    const response = await harness.request({
      method: (routeConfig.method || 'get').toUpperCase(),
      path: routeConfig.paths[0],
      query: routeConfig.query,
      body: routeConfig.body,
    });

    expect(response.status).toBe(401);
  });

  test('dashboard summary returns service payload', async () => {
    const response = await harness.request({
      path: '/api/internal/ai/dashboard/summary',
      query: { business_id: BUSINESS_ID, period: '7d' },
    });

    expect(response.status).toBe(200);
    expect(response.body.revenue).toBe(100);
    expect(dashboardServiceMock.getDashboardSummary).toHaveBeenCalledWith(BUSINESS_ID, '7d');
  });

  test('dashboard summary rejects missing business_id', async () => {
    const response = await harness.request({
      path: '/api/internal/ai/dashboard/summary',
      query: {},
    });

    expect(response.status).toBe(400);
  });

  test('event creation returns 201 and logged payload', async () => {
    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/ai/events',
      body: { business_id: BUSINESS_ID, event_type: 'call.missed' },
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(activityLogMock.logActivity).toHaveBeenCalledWith({ business_id: BUSINESS_ID, event_type: 'call.missed' });
  });

  test('event creation validates required fields', async () => {
    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/ai/events',
      body: { business_id: BUSINESS_ID },
    });

    expect(response.status).toBe(400);
  });

  test('price lookup returns AI-ready items', async () => {
    const response = await harness.request({
      path: '/api/internal/ai/price-lookup',
      query: { business_id: BUSINESS_ID, search: 'HVAC' },
    });

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([{ id: 'price-1' }]);
  });

  test('price lookup requires search or service', async () => {
    const response = await harness.request({
      path: '/api/internal/ai/price-lookup',
      query: { business_id: BUSINESS_ID },
    });

    expect(response.status).toBe(400);
  });

  test('radius check returns business radius data', async () => {
    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/ai/radius-check',
      body: { business_id: BUSINESS_ID, customer_zip: '75002' },
    });

    expect(response.status).toBe(200);
    expect(response.body.service_radius_miles).toBe(25);
  });

  test('radius check validates required fields', async () => {
    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/ai/radius-check',
      body: { business_id: BUSINESS_ID },
    });

    expect(response.status).toBe(400);
  });

  test('booking a quote creates automation artifacts', async () => {
    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/ai/book',
      body: {
        business_id: BUSINESS_ID,
        booking_type: 'Quote',
        customer_id: VALID_UUID,
        service_name: 'Estimate',
        scheduled_start_time: '2026-04-05T12:00:00.000Z',
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.booking_type).toBe('Quote');
    expect(response.body.automation.follow_up).toEqual({ id: 'follow-up-1' });
  });

  test('booking a job can create a customer first', async () => {
    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/ai/book',
      body: {
        business_id: BUSINESS_ID,
        booking_type: 'Job',
        customer: {
          first_name: 'New',
          last_name: 'Caller',
          phone_number: '+15555550123',
        },
        service_name: 'Emergency visit',
        address: '123 Main St',
      },
    });

    expect(response.status).toBe(201);
    expect(customerServiceMock.create).toHaveBeenCalledTimes(1);
    expect(response.body.automation.team_checkin).toEqual({ id: 'checkin-1' });
  });

  test('booking validates customer or customer_id presence', async () => {
    const response = await harness.request({
      method: 'POST',
      path: '/api/internal/ai/book',
      body: {
        business_id: BUSINESS_ID,
        booking_type: 'Job',
      },
    });

    expect(response.status).toBe(400);
  });

  test('business config returns business context', async () => {
    harness.authState.fail = 'requireInternalApiKey';
    harness.authState.status = 401;

    const response = await harness.request({
      path: '/api/internal/ai/business-config',
      query: { business_id: BUSINESS_ID },
    });

    expect(response.status).toBe(200);
    expect(response.body.business.id).toBe(BUSINESS_ID);
    expect(response.body.service_categories).toEqual([{ id: 'cat-1' }]);
  });

  test('business config requires the AI service API key middleware', async () => {
    harness.authState.fail = 'requireAiServiceApiKey';
    harness.authState.status = 401;

    const response = await harness.request({
      path: '/api/internal/ai/business-config',
      query: { business_id: BUSINESS_ID },
    });

    expect(response.status).toBe(401);
  });

  test('business config returns 404 when business is missing', async () => {
    prismaMock.business.findUnique.mockResolvedValueOnce(null);

    const response = await harness.request({
      path: '/api/internal/ai/business-config',
      query: { business_id: BUSINESS_ID },
    });

    expect(response.status).toBe(404);
  });
});
