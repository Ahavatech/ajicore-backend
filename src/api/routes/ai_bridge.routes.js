/**
 * AI Bridge Routes
 * Internal API for the AI service (call center, SMS, data queries).
 * Protected by x-api-key, with most business-scoped routes also requiring x-business-token.
 *
 * @swagger
 * tags:
 *   name: AI Bridge
 *   description: Internal AI service endpoints (x-api-key required; most business-scoped routes also require x-business-token)
 */
const { Router } = require('express');
const {
  requireInternalApiKey,
  requireInternalBusinessAccess,
  requireInternalResourceAccess,
} = require('../middlewares/auth.middleware');
const { requireFields } = require('../middlewares/validate.middleware');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const jobController = require('../../domains/jobs/job.controller');
const quoteController = require('../../domains/quotes/quote.controller');
const materialController = require('../../domains/inventory/material.controller');
const customerController = require('../../domains/customers/customer.controller');
const smsController = require('../../domains/communications/sms.controller');
const pbService = require('../../domains/pricebook/pricebook.service');
const quoteService = require('../../domains/quotes/quote.service');
const jobService = require('../../domains/jobs/job.service');
const customerService = require('../../domains/customers/customer.service');
const notificationService = require('../../domains/communications/notification.service');
const { generateDashboardSummary } = require('../../utils/report_generator');
const logger = require('../../utils/logger');

const router = Router();
router.use(requireInternalApiKey);

// ============================================
// Schedule & Jobs
// ============================================
router.get('/schedule', requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), jobController.getSchedule);
router.get('/jobs', requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), jobController.getAllJobs);
router.post('/jobs', requireFields(['business_id', 'customer_id'], 'body'), requireInternalBusinessAccess('body'), jobController.createJob);
router.patch('/jobs/:id', requireInternalResourceAccess('job'), jobController.updateJob);
router.post('/jobs/:id/start', requireInternalResourceAccess('job'), jobController.startJob);
router.post('/jobs/:id/complete', requireInternalResourceAccess('job'), jobController.completeJob);

// ============================================
// Quotes
// ============================================
router.get('/quotes', requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), quoteController.getAll);
router.post('/quotes', requireFields(['business_id', 'customer_id'], 'body'), requireInternalBusinessAccess('body'), quoteController.create);
router.patch('/quotes/:id', requireInternalResourceAccess('quote'), quoteController.update);
router.post('/quotes/:id/send', requireInternalResourceAccess('quote'), quoteController.sendQuote);
router.post('/quotes/:id/approve', requireInternalResourceAccess('quote'), quoteController.approve);

// ============================================
// Customers
// ============================================
router.get('/customers', requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), customerController.getAll);
router.get('/customers/lookup', requireFields(['business_id', 'phone'], 'query'), requireInternalBusinessAccess('query'), customerController.findByPhone);
router.post('/customers', requireFields(['business_id', 'first_name', 'last_name'], 'body'), requireInternalBusinessAccess('body'), customerController.create);

// ============================================
// Inventory
// ============================================
router.get('/inventory', requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), materialController.getAllMaterials);

// ============================================
// Dashboard
// ============================================
router.get('/dashboard/summary', requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), async (req, res, next) => {
  try {
    const { business_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id required' });
    const summary = await generateDashboardSummary(business_id);
    res.json(summary);
  } catch (err) { next(err); }
});

// ============================================
// AI Call Flow: Price Book Lookup
// ============================================
/**
 * @swagger
 * /api/internal/ai/price-lookup:
 *   get:
 *     summary: Look up pricing for a service (AI call flow)
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: {type: string}
 *       - in: query
 *         name: service
 *         required: true
 *         schema: {type: string}
 *         description: Service name or description from caller
 */
router.get('/ai/price-lookup', requireFields(['business_id', 'service'], 'query'), requireInternalBusinessAccess('query'), async (req, res, next) => {
  try {
    const { business_id, service } = req.query;
    if (!business_id || !service) return res.status(400).json({ error: 'business_id and service are required' });
    const items = await pbService.lookupForAI(business_id, service);
    const business = await prisma.business.findUnique({ where: { id: business_id } });
    res.json({ items, unknown_service_handling: business?.unknown_service_handling, unknown_service_call_fee: business?.unknown_service_call_fee });
  } catch (err) { next(err); }
});

// ============================================
// AI Call Flow: Service Radius Check
// ============================================
/**
 * @swagger
 * /api/internal/ai/radius-check:
 *   post:
 *     summary: Check if customer ZIP is within service radius and calculate any mileage fee
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 */
router.post('/ai/radius-check', requireFields(['business_id', 'customer_zip'], 'body'), requireInternalBusinessAccess('body'), async (req, res, next) => {
  try {
    const { business_id, customer_zip } = req.body;
    if (!business_id || !customer_zip) return res.status(400).json({ error: 'business_id and customer_zip required' });

    const business = await prisma.business.findUnique({ where: { id: business_id } });
    if (!business || !business.service_radius_miles) {
      return res.json({ within_radius: true, extra_miles: 0, mileage_fee: 0 });
    }

    // Return radius config for AI to use (actual distance calc happens AI-side with GPS)
    res.json({
      home_base_zip: business.home_base_zip,
      service_radius_miles: business.service_radius_miles,
      cost_per_mile_over_radius: business.cost_per_mile_over_radius || 0,
      customer_zip,
      message: 'Use GPS coordinates to compute actual distance and apply mileage fee if outside radius',
    });
  } catch (err) { next(err); }
});

// ============================================
// AI Call Flow: Book from call (creates quote or job)
// ============================================
/**
 * @swagger
 * /api/internal/ai/book:
 *   post:
 *     summary: Book a job or quote from AI call flow
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, booking_type]
 *             properties:
 *               business_id: {type: string}
 *               booking_type: {type: string, enum: [Quote, Job, ServiceCall]}
 *               customer: {type: object, description: Customer info (new or existing)}
 *               customer_id: {type: string, description: Existing customer ID}
 *               service_name: {type: string}
 *               price_book_item_id: {type: string}
 *               service_call_fee: {type: number}
 *               scheduled_start_time: {type: string, format: date-time}
 *               is_emergency: {type: boolean}
 *               notes: {type: string}
 */
router.post('/ai/book', requireFields(['business_id', 'booking_type'], 'body'), requireInternalBusinessAccess('body'), async (req, res, next) => {
  try {
    const { business_id, booking_type, customer, customer_id, service_name,
      price_book_item_id, service_call_fee, scheduled_start_time, is_emergency, notes } = req.body;

    if (!business_id || !booking_type) {
      return res.status(400).json({ error: 'business_id and booking_type are required' });
    }

    // Resolve or create customer
    let resolvedCustomerId = customer_id;
    if (!resolvedCustomerId && customer) {
      let existing = null;
      if (customer.phone_number) {
        existing = await customerService.findByPhone(business_id, customer.phone_number);
      }
      if (existing) {
        resolvedCustomerId = existing.id;
      } else {
        const newCust = await customerService.create({ business_id, ...customer });
        resolvedCustomerId = newCust.id;
      }
    }

    if (!resolvedCustomerId) return res.status(400).json({ error: 'customer or customer_id is required' });

    let result;

    if (booking_type === 'Quote') {
      result = await quoteService.create({
        business_id,
        customer_id: resolvedCustomerId,
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
        type: booking_type === 'ServiceCall' ? 'ServiceCall' : 'Job',
        title: service_name || 'Service Job',
        job_details: notes || null,
        price_book_item_id: price_book_item_id || null,
        service_call_fee: service_call_fee || null,
        scheduled_start_time: scheduled_start_time || null,
        is_emergency: is_emergency ?? false,
        source: 'AI',
      });
    }

    logger.info(`AI booked ${booking_type} for business ${business_id}`, { id: result.id });
    res.status(201).json({ booking_type, result });
  } catch (err) { next(err); }
});

// ============================================
// AI Call Flow: Business config for AI receptionist
// ============================================
/**
 * @swagger
 * /api/internal/ai/business-config:
 *   get:
 *     summary: Get complete business configuration for AI receptionist
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 */
router.get('/ai/business-config', requireFields(['business_id'], 'query'), requireInternalBusinessAccess('query'), async (req, res, next) => {
  try {
    const { business_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id required' });

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
        name: business.name,
        industry: business.industry,
        ai_business_description: business.ai_business_description,
        home_base_zip: business.home_base_zip,
        service_radius_miles: business.service_radius_miles,
        cost_per_mile_over_radius: business.cost_per_mile_over_radius,
        unknown_service_handling: business.unknown_service_handling,
        unknown_service_call_fee: business.unknown_service_call_fee,
        quote_expiry_days: business.quote_expiry_days,
      },
      service_categories: categories,
      price_book: priceItems,
    });
  } catch (err) { next(err); }
});

// ============================================
// SMS Handling
// ============================================

/**
 * @swagger
 * /api/internal/sms/incoming:
 *   post:
 *     summary: Twilio webhook for incoming SMS (text command center)
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 */
router.post('/sms/incoming', smsController.handleIncomingSms);

/**
 * @swagger
 * /api/internal/sms/send:
 *   post:
 *     summary: Send outbound SMS
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 */
router.post('/sms/send', requireFields(['business_id', 'to', 'message'], 'body'), requireInternalBusinessAccess('body'), smsController.sendSms);

module.exports = router;
