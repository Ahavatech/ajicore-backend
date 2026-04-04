/**
 * AI Bridge Routes
 * Internal API for the AI service plus provider-facing inbound webhook entrypoints.
 *
 * @swagger
 * tags:
 *   name: AI Bridge
 *   description: Internal AI service endpoints and inbound provider webhooks
 */
const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const {
  requireInternalApiKey,
  requireInternalBusinessAccess,
  requireInternalResourceAccess,
} = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');
<<<<<<< HEAD
=======
const prisma = require('../../lib/prisma');

>>>>>>> 6d5423ff8eb12b6157f081896d0405cb02652acc
const jobController = require('../../domains/jobs/job.controller');
const quoteController = require('../../domains/quotes/quote.controller');
const materialController = require('../../domains/inventory/material.controller');
const customerController = require('../../domains/customers/customer.controller');
const smsController = require('../../domains/communications/sms.controller');
const aiIngressService = require('../../domains/communications/ai_ingress.service');
const staffController = require('../../domains/team/staff.controller');
const billingController = require('../../domains/billing/invoice.controller');
const followUpController = require('../../domains/follow_ups/follow_up.controller');
const teamCheckinController = require('../../domains/team_checkins/team_checkin.controller');
const pbController = require('../../domains/pricebook/pricebook.controller');
const pbService = require('../../domains/pricebook/pricebook.service');
const quoteService = require('../../domains/quotes/quote.service');
const jobService = require('../../domains/jobs/job.service');
const customerService = require('../../domains/customers/customer.service');
const dashboardService = require('../../domains/dashboard/dashboard.service');
const businessController = require('../../domains/business/business.controller');
const conversationController = require('../../domains/conversations/conversation.controller');
const aiLogController = require('../../domains/ai_logs/ai_event_log.controller');
const { logActivity } = require('../../domains/ai_logs/activity_log.service');
const logger = require('../../utils/logger');

const prisma = new PrismaClient();
const router = Router();

function withAiAlias(primaryPath, legacyPath) {
  return legacyPath ? [primaryPath, legacyPath] : primaryPath;
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function withInternalBusinessIdInQuery(handler) {
  return (req, res, next) => {
    req.query.business_id = req.query.business_id || req.internalBusinessId;
    return handler(req, res, next);
  };
}

async function createAiAutomationArtifacts({
  businessId,
  business,
  bookingType,
  bookingResult,
  customerId,
  assignedStaffId,
  scheduledStartTime,
}) {
  const automationSettings = business?.automation_settings && typeof business.automation_settings === 'object'
    ? business.automation_settings
    : {};

  const artifacts = {};
  const scheduledFor = scheduledStartTime
    ? new Date(scheduledStartTime)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (bookingType === 'Quote' && automationSettings.quote_follow_ups_enabled !== false) {
    artifacts.follow_up = await prisma.followUp.create({
      data: {
        business_id: businessId,
        type: 'Quote',
        reference_id: bookingResult.id,
        customer_id: customerId,
        scheduled_for: scheduledFor,
        channel: 'SMS',
        status: 'Scheduled',
      },
    });
  }

  if (bookingType !== 'Quote' && assignedStaffId && automationSettings.team_checkins_enabled !== false) {
    const frequencyHours = Number(automationSettings.default_check_in_frequency_hours || 1);
    const checkinTime = scheduledStartTime
      ? new Date(new Date(scheduledStartTime).getTime() + frequencyHours * 60 * 60 * 1000)
      : new Date(Date.now() + frequencyHours * 60 * 60 * 1000);

    artifacts.team_checkin = await prisma.teamCheckin.create({
      data: {
        job_id: bookingResult.id,
        staff_id: assignedStaffId,
        scheduled_at: checkinTime,
        status: 'Pending',
      },
    });
  }

  return artifacts;
}

// ============================================
// Provider-Facing Inbound Webhooks
// ============================================

/**
 * @swagger
 * /api/internal/ai/sms/incoming:
 *   post:
 *     summary: Receive inbound SMS from a provider webhook
 *     tags: [AI Bridge]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AIBridgeInboundSmsInput'
 *     responses:
 *       200:
 *         description: Inbound SMS accepted and routed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIBridgeWebhookResponse'
 */
router.post(withAiAlias('/ai/sms/incoming', '/sms/incoming'), async (req, res, next) => {
  try {
    const result = await aiIngressService.handleInboundSms(req.body);
    const isTwilioWebhook = Boolean(req.body?.Body || req.body?.From || req.body?.To);

    if (isTwilioWebhook) {
      res.set('Content-Type', 'text/xml');
      return res.send(`
        <Response>
          <Message>${escapeXml(result.ai_reply)}</Message>
        </Response>
      `);
    }

    res.json({
      success: true,
      business_id: result.business.id,
      customer_id: result.customer?.id || null,
      reply: result.ai_reply,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/internal/ai/calls/incoming:
 *   post:
 *     summary: Receive an inbound call event from a provider webhook
 *     tags: [AI Bridge]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AIBridgeInboundCallInput'
 *     responses:
 *       200:
 *         description: Inbound call accepted and routed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIBridgeWebhookResponse'
 */
router.post(withAiAlias('/ai/calls/incoming', '/calls/incoming'), async (req, res, next) => {
  try {
    const result = await aiIngressService.handleInboundCall(req.body);
    const isTwilioWebhook = Boolean(req.body?.CallSid || req.body?.From || req.body?.To);

    if (isTwilioWebhook) {
      res.set('Content-Type', 'text/xml');
      return res.send(`
        <Response>
          <Say>${escapeXml(result.ai_response?.message || 'Please hold while we process your call.')}</Say>
        </Response>
      `);
    }

    res.json({
      success: true,
      business_id: result.business.id,
      customer_id: result.customer?.id || null,
      data: result.ai_response,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/internal/ai/calls/status:
 *   post:
 *     summary: Receive call status updates from a provider webhook
 *     tags: [AI Bridge]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AIBridgeCallStatusInput'
 *     responses:
 *       200:
 *         description: Call status accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIBridgeWebhookResponse'
 */
router.post(withAiAlias('/ai/calls/status', '/calls/status'), async (req, res, next) => {
  try {
    const result = await aiIngressService.handleCallStatus(req.body);
    res.json({
      success: true,
      business_id: result.business.id,
      customer_id: result.customer?.id || null,
      status: result.status,
      call_sid: result.call_sid || null,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// Protected Internal AI Routes
// ============================================
router.use(requireInternalApiKey);

// ============================================
// Schedule, Jobs, Staff
// ============================================
router.get(withAiAlias('/ai/schedule', '/schedule'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), jobController.getSchedule);
router.get(withAiAlias('/ai/jobs', '/jobs'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), jobController.getAllJobs);
router.get(withAiAlias('/ai/jobs/:id', '/jobs/:id'), requireInternalResourceAccess('job'), jobController.getJobById);
router.post(withAiAlias('/ai/jobs', '/jobs'), requireFields(['business_id', 'customer_id'], 'body'), requireInternalBusinessAccess('body'), jobController.createJob);
router.patch(withAiAlias('/ai/jobs/:id', '/jobs/:id'), requireInternalResourceAccess('job'), jobController.updateJob);
router.post(withAiAlias('/ai/jobs/:id/start', '/jobs/:id/start'), requireInternalResourceAccess('job'), jobController.startJob);
router.post(withAiAlias('/ai/jobs/:id/complete', '/jobs/:id/complete'), requireInternalResourceAccess('job'), jobController.completeJob);

router.get(withAiAlias('/ai/staff', '/staff'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), staffController.getAllStaff);
router.get(withAiAlias('/ai/staff/availability', '/staff/availability'),
  requireFields(['staff_id', 'start_time', 'end_time'], 'query'),
  requireInternalResourceAccess('staff', { source: 'query', field: 'staff_id', notFoundLabel: 'staff member' }),
  jobController.checkAvailability);
router.get(withAiAlias('/ai/staff/:id', '/staff/:id'), requireInternalResourceAccess('staff'), staffController.getStaffById);

// ============================================
// Quotes
// ============================================
router.get(withAiAlias('/ai/quotes', '/quotes'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), quoteController.getAll);
router.get(withAiAlias('/ai/quotes/:id', '/quotes/:id'), requireInternalResourceAccess('quote'), quoteController.getById);
router.post(withAiAlias('/ai/quotes', '/quotes'), requireFields(['business_id', 'customer_id'], 'body'), requireInternalBusinessAccess('body'), quoteController.create);
router.patch(withAiAlias('/ai/quotes/:id', '/quotes/:id'), requireInternalResourceAccess('quote'), quoteController.update);
router.post(withAiAlias('/ai/quotes/:id/send', '/quotes/:id/send'), requireInternalResourceAccess('quote'), quoteController.sendQuote);
router.post(withAiAlias('/ai/quotes/:id/approve', '/quotes/:id/approve'), requireInternalResourceAccess('quote'), quoteController.approve);
router.post(withAiAlias('/ai/quotes/:id/decline', '/quotes/:id/decline'), requireInternalResourceAccess('quote'), quoteController.decline);

// ============================================
// Customers
// ============================================
router.get(withAiAlias('/ai/customers', '/customers'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), customerController.getAll);
router.get(withAiAlias('/ai/customers/lookup', '/customers/lookup'), requireFields(['business_id', 'phone'], 'query'), requireInternalBusinessAccess('query'), customerController.findByPhone);
router.get(withAiAlias('/ai/customers/:id', '/customers/:id'), requireInternalResourceAccess('customer'), customerController.getById);
router.get(withAiAlias('/ai/customers/:id/history', '/customers/:id/history'), requireInternalResourceAccess('customer'), customerController.getHistory);
router.post(withAiAlias('/ai/customers', '/customers'), requireFields(['business_id', 'first_name', 'last_name'], 'body'), requireInternalBusinessAccess('body'), customerController.create);

// ============================================
// Inventory and Price Book
// ============================================
router.get(withAiAlias('/ai/inventory', '/inventory'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), materialController.getAllMaterials);
router.get(withAiAlias('/ai/price-book', '/price-book'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), pbController.getItems);
router.get(withAiAlias('/ai/price-book/:id', '/price-book/:id'), requireInternalResourceAccess('priceBookItem', { notFoundLabel: 'price book item' }), pbController.getItemById);

// ============================================
// Billing
// ============================================
router.get(withAiAlias('/ai/invoices', '/invoices'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), billingController.getAll);
router.get(withAiAlias('/ai/invoices/:id/total', '/invoices/:id/total'), requireInternalResourceAccess('invoice'), billingController.getTotal);
router.get(withAiAlias('/ai/invoices/:id', '/invoices/:id'), requireInternalResourceAccess('invoice'), billingController.getById);
router.post(withAiAlias('/ai/invoices', '/invoices'), requireFields(['job_id', 'business_id'], 'body'), requireInternalBusinessAccess('body'), billingController.createInvoice);
router.patch(withAiAlias('/ai/invoices/:id', '/invoices/:id'), requireInternalResourceAccess('invoice'), billingController.updateInvoice);
router.post(withAiAlias('/ai/invoices/:id/send', '/invoices/:id/send'), requireInternalResourceAccess('invoice'), billingController.sendInvoice);
router.post(withAiAlias('/ai/invoices/:id/void', '/invoices/:id/void'), requireInternalResourceAccess('invoice'), billingController.voidInvoice);
router.post(withAiAlias('/ai/invoices/:id/refund', '/invoices/:id/refund'), requireInternalResourceAccess('invoice'), billingController.refundInvoice);
router.post(withAiAlias('/ai/payments/:invoiceId', '/payments/:invoiceId'), requireInternalResourceAccess('invoice', { field: 'invoiceId' }), requireFields(['amount']), billingController.processPayment);

// ============================================
// Follow-Ups and Team Check-Ins
// ============================================
router.get(withAiAlias('/ai/follow-ups', '/follow-ups'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), followUpController.list);
router.post(withAiAlias('/ai/follow-ups', '/follow-ups'), requireFields(['business_id'], 'body'), requireInternalBusinessAccess('body'), followUpController.create);
router.patch(withAiAlias('/ai/follow-ups/:id', '/follow-ups/:id'), requireInternalResourceAccess('followUp', { notFoundLabel: 'follow-up' }), followUpController.update);
router.post(withAiAlias('/ai/follow-ups/:id/sent', '/follow-ups/:id/sent'), requireInternalResourceAccess('followUp', { notFoundLabel: 'follow-up' }), followUpController.markSent);
router.post(withAiAlias('/ai/follow-ups/:id/cancel', '/follow-ups/:id/cancel'), requireInternalResourceAccess('followUp', { notFoundLabel: 'follow-up' }), followUpController.cancel);

router.get(withAiAlias('/ai/team-checkins', '/team-checkins'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), teamCheckinController.list);
router.post(
  withAiAlias('/ai/team-checkins', '/team-checkins'),
  requireFields(['staff_id', 'scheduled_at'], 'body'),
  requireInternalResourceAccess('staff', { source: 'body', field: 'staff_id', notFoundLabel: 'staff member' }),
  teamCheckinController.create
);
router.patch(withAiAlias('/ai/team-checkins/:id', '/team-checkins/:id'), requireInternalResourceAccess('teamCheckin', { notFoundLabel: 'team check-in' }), teamCheckinController.update);
router.post(withAiAlias('/ai/team-checkins/:id/receive', '/team-checkins/:id/receive'), requireInternalResourceAccess('teamCheckin', { notFoundLabel: 'team check-in' }), teamCheckinController.receive);
router.post(withAiAlias('/ai/team-checkins/:id/escalate', '/team-checkins/:id/escalate'), requireInternalResourceAccess('teamCheckin', { notFoundLabel: 'team check-in' }), teamCheckinController.escalate);

// ============================================
// Dashboard, Events, Conversations
// ============================================
router.get(withAiAlias('/ai/dashboard/summary', '/dashboard/summary'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), async (req, res, next) => {
  try {
    const { business_id, period } = req.query;
    const summary = await dashboardService.getDashboardSummary(business_id, period);
    res.json(summary);
  } catch (err) { next(err); }
});

router.get(withAiAlias('/ai/events/event-types', '/events/event-types'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), aiLogController.eventTypes);
router.get(withAiAlias('/ai/events', '/events'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), aiLogController.list);

/**
 * @swagger
 * /api/internal/ai/events:
 *   post:
 *     summary: Record a dashboard activity event from internal AI or call systems
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InternalActivityEventInput'
 *     responses:
 *       201:
 *         description: Event recorded
 */
router.post(withAiAlias('/ai/events', '/events'), requireFields(['business_id', 'event_type'], 'body'), requireInternalBusinessAccess('body'), async (req, res, next) => {
  try {
    const entry = await logActivity(req.body);
    res.status(201).json({ success: true, data: entry });
  } catch (err) { next(err); }
});

router.get(withAiAlias('/ai/conversations', '/conversations'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), conversationController.list);
router.get(
  withAiAlias('/ai/conversations/:customer_id', '/conversations/:customer_id'),
  requireInternalResourceAccess('customer', { source: 'params', field: 'customer_id', notFoundLabel: 'customer' }),
  withInternalBusinessIdInQuery(conversationController.show)
);

// ============================================
// AI Call Flow Helpers
// ============================================
/**
 * @swagger
 * /api/internal/ai/events:
 *   get:
 *     summary: List AI bridge activity events for a business
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Paginated event list
 * /api/internal/ai/events/event-types:
 *   get:
 *     summary: List distinct event types for a business
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Event type list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalEventTypeListResponse'
 *
 * /api/internal/ai/price-lookup:
 *   get:
 *     summary: Look up price book services for AI workflows
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: service
 *         schema:
 *           type: string
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: can_quote_phone
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Matching price book services
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIPriceLookupResponse'
 */
router.get('/ai/price-lookup', requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), async (req, res, next) => {
  try {
    const { business_id, service, search, category_id, can_quote_phone, limit } = req.query;
    const query = search || service;
    if (!query) return res.status(400).json({ error: 'search or service is required' });

    const items = await pbService.lookupForAI(business_id, {
      query,
      category_id,
      can_quote_phone,
      limit,
    });
    const business = await prisma.business.findUnique({ where: { id: business_id } });
    res.json({
      items,
      unknown_service_handling: business?.unknown_service_handling,
      unknown_service_call_fee: business?.unknown_service_call_fee,
    });
  } catch (err) { next(err); }
});

router.post('/ai/radius-check', requireFields(['business_id', 'customer_zip'], 'body'), requireInternalBusinessAccess('body'), async (req, res, next) => {
  try {
    const { business_id, customer_zip } = req.body;
    const business = await prisma.business.findUnique({ where: { id: business_id } });
    if (!business || !business.service_radius_miles) {
      return res.json({ within_radius: true, extra_miles: 0, mileage_fee: 0 });
    }

    res.json({
      home_base_zip: business.home_base_zip,
      service_radius_miles: business.service_radius_miles,
      cost_per_mile_over_radius: business.cost_per_mile_over_radius || 0,
      customer_zip,
      message: 'Use GPS coordinates to compute actual distance and apply mileage fee if outside radius',
    });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/internal/ai/book:
 *   post:
 *     summary: Book a quote, job, or service call from an AI workflow
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AIBookingInput'
 *     responses:
 *       201:
 *         description: Booking created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIBookingResponse'
 */
router.post('/ai/book', requireFields(['business_id', 'booking_type'], 'body'), requireInternalBusinessAccess('body'), async (req, res, next) => {
  try {
    const {
      business_id,
      booking_type,
      customer,
      customer_id,
      service_name,
      price_book_item_id,
      service_call_fee,
      scheduled_start_time,
      scheduled_end_time,
      assigned_staff_id,
      address,
      service_type,
      is_emergency,
      notes,
    } = req.body;

    let resolvedCustomerId = customer_id;
    let resolvedCustomer = null;

    if (!resolvedCustomerId && customer) {
      if (customer.phone_number) {
        resolvedCustomer = await customerService.findByPhone(business_id, customer.phone_number);
      }

      if (!resolvedCustomer) {
        resolvedCustomer = await customerService.create({
          business_id,
          first_name: customer.first_name || 'Inbound',
          last_name: customer.last_name || 'Customer',
          phone_number: customer.phone_number || null,
          email: customer.email || null,
          address: customer.address || null,
          zip_code: customer.zip_code || null,
          notes: customer.notes || null,
        });
      }

      resolvedCustomerId = resolvedCustomer.id;
    }

    if (!resolvedCustomerId) {
      return res.status(400).json({ error: 'customer or customer_id is required' });
    }

    const business = await prisma.business.findUnique({ where: { id: business_id } });
    let result;

    if (booking_type === 'Quote') {
      result = await quoteService.create({
        business_id,
        customer_id: resolvedCustomerId,
        assigned_staff_id: assigned_staff_id || null,
        title: service_name || 'Service Estimate',
        description: notes || null,
        price_book_item_id: price_book_item_id || null,
        scheduled_estimate_date: scheduled_start_time || null,
        is_emergency: is_emergency ?? false,
        source: 'AI',
      });
    } else {
      result = await jobService.createJob({
        business_id,
        customer_id: resolvedCustomerId,
        assigned_staff_id: assigned_staff_id || null,
        type: booking_type === 'ServiceCall' ? 'ServiceCall' : 'Job',
        title: service_name || 'Service Job',
        job_details: notes || null,
        price_book_item_id: price_book_item_id || null,
        service_call_fee: service_call_fee || null,
        service_type: service_type || service_name || null,
        address: address || customer?.address || null,
        scheduled_start_time: scheduled_start_time || null,
        scheduled_end_time: scheduled_end_time || null,
        is_emergency: is_emergency ?? false,
        source: 'AI',
      });
    }

    const automationArtifacts = await createAiAutomationArtifacts({
      businessId: business_id,
      business,
      bookingType: booking_type,
      bookingResult: result,
      customerId: resolvedCustomerId,
      assignedStaffId: assigned_staff_id || result.assigned_staff_id || null,
      scheduledStartTime: scheduled_start_time,
    });

    logger.info(`AI booked ${booking_type} for business ${business_id}`, { id: result.id });
    res.status(201).json({
      booking_type,
      result,
      automation: automationArtifacts,
    });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/internal/ai/business-config:
 *   get:
 *     summary: Fetch AI receptionist and dispatcher business context
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Business config, categories, and price book
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIBusinessConfigResponse'
 */
router.get('/ai/business-config', requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), async (req, res, next) => {
  try {
    const { business_id } = req.query;
    const [business, categories, priceItems] = await Promise.all([
      prisma.business.findUnique({ where: { id: business_id } }),
      prisma.serviceCategory.findMany({ where: { business_id, is_active: true } }),
      prisma.priceBookItem.findMany({
        where: { business_id, is_active: true },
        include: { category: true },
      }),
    ]);

    if (!business) return res.status(404).json({ error: 'Business not found' });

    res.json({
      business: {
        id: business.id,
        name: business.name,
        industry: business.industry,
        business_hours: business.business_hours,
        timezone: business.timezone,
        company_phone: business.company_phone,
        owner_phone: business.owner_phone,
        dedicated_phone_number: business.dedicated_phone_number,
        ai_phone_number: business.ai_phone_number,
        ai_receptionist_name: business.ai_receptionist_name,
        voice_gender: business.voice_gender,
        ai_business_description: business.ai_business_description,
        home_base_zip: business.home_base_zip,
        service_radius_miles: business.service_radius_miles,
        cost_per_mile_over_radius: business.cost_per_mile_over_radius,
        service_area_description: business.service_area_description,
        unknown_service_handling: business.unknown_service_handling,
        unknown_service_call_fee: business.unknown_service_call_fee,
        quote_expiry_days: business.quote_expiry_days,
        payment_follow_up_days: business.payment_follow_up_days,
        payment_interval: business.payment_interval,
        alert_settings: business.alert_settings,
        automation_settings: business.automation_settings,
        communication_settings: business.communication_settings,
      },
      service_categories: categories,
      price_book: priceItems,
    });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /api/internal/ai/business/profile:
 *   get:
 *     summary: Read business profile settings through the AI bridge
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Business profile payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessProfileResponse'
 * /api/internal/ai/business/alerts:
 *   get:
 *     summary: Read alert settings through the AI bridge
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Alert settings payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessAlertSettingsResponse'
 * /api/internal/ai/business/automation:
 *   get:
 *     summary: Read automation settings through the AI bridge
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Automation settings payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessAutomationSettingsResponse'
 * /api/internal/ai/business/communication:
 *   get:
 *     summary: Read communication settings through the AI bridge
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Communication settings payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessCommunicationSettingsResponse'
 */
// ============================================
// Internal Business Settings Wrappers
// ============================================
router.get(withAiAlias('/ai/business/profile', '/business/profile'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), businessController.getProfile);
router.get(withAiAlias('/ai/business/alerts', '/business/alerts'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), businessController.getAlerts);
router.get(withAiAlias('/ai/business/automation', '/business/automation'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), businessController.getAutomation);
router.get(withAiAlias('/ai/business/communication', '/business/communication'), requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), businessController.getCommunication);

/**
 * @swagger
 * /api/internal/ai/conversations:
 *   get:
 *     summary: List grouped customer conversations for AI context
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Conversation summary list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConversationListResponse'
 * /api/internal/ai/conversations/{customer_id}:
 *   get:
 *     summary: Read detailed event history for one customer conversation
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     parameters:
 *       - in: path
 *         name: customer_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detailed conversation history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConversationDetailResponse'
 * /api/internal/ai/price-book:
 *   get:
 *     summary: List price book items through the AI bridge
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Price book items
 * /api/internal/ai/price-book/{id}:
 *   get:
 *     summary: Read one price book item through the AI bridge
 *     tags: [AI Bridge]
 *     security:
 *       - apiKeyAuth: []
 *       - businessTokenAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Price book item
 */
// ============================================
// Outbound SMS
// ============================================
router.post(withAiAlias('/ai/sms/send', '/sms/send'), requireFields(['business_id', 'to', 'message'], 'body'), requireInternalBusinessAccess('body'), smsController.sendSms);

module.exports = router;
