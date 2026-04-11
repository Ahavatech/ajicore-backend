const fs = require('node:fs');
const path = require('node:path');
const swaggerSpec = require('../src/config/swagger');

const OUTPUT_OPENAPI = path.resolve(__dirname, '..', 'docs', 'api.json');
const OUTPUT_POSTMAN = path.resolve(__dirname, '..', 'docs', 'api.postman_collection.json');

const secured = [{ apiKeyAuth: [], businessTokenAuth: [] }];

function ref(name) {
  return { $ref: `#/components/schemas/${name}` };
}

function queryParam(name, description, required = false, type = 'string', format) {
  const schema = { type };
  if (format) schema.format = format;
  return {
    in: 'query',
    name,
    required,
    description,
    schema,
  };
}

function pathParam(name, description, type = 'string', format = 'uuid') {
  const schema = { type };
  if (format) schema.format = format;
  return {
    in: 'path',
    name,
    required: true,
    description,
    schema,
  };
}

function requestBody(schema, description = 'Request payload') {
  return {
    required: true,
    description,
    content: {
      'application/json': {
        schema,
      },
    },
  };
}

function jsonResponse(description, schema) {
  return {
    description,
    content: {
      'application/json': {
        schema,
      },
    },
  };
}

const paginationResponse = ref('Pagination');
const genericObject = { type: 'object', additionalProperties: true };

const jobWriteSchema = {
  type: 'object',
  required: ['business_id', 'customer_id'],
  properties: {
    business_id: { type: 'string', format: 'uuid' },
    customer_id: { type: 'string', format: 'uuid' },
    assigned_staff_id: { type: 'string', format: 'uuid', nullable: true },
    type: { type: 'string', enum: ['Job', 'ServiceCall'], example: 'Job' },
    title: { type: 'string', example: 'Emergency HVAC Visit' },
    job_details: { type: 'string', example: 'Customer reports no cooling' },
    service_type: { type: 'string', example: 'HVAC Repair' },
    address: { type: 'string', example: '123 Main St, Dallas TX' },
    scheduled_start_time: { type: 'string', format: 'date-time' },
    scheduled_end_time: { type: 'string', format: 'date-time', nullable: true },
    service_call_fee: { type: 'number', nullable: true, example: 99 },
    is_emergency: { type: 'boolean', example: true },
  },
};

const jobUpdateSchema = {
  type: 'object',
  properties: jobWriteSchema.properties,
};

const quoteWriteSchema = {
  type: 'object',
  required: ['business_id', 'customer_id'],
  properties: {
    business_id: { type: 'string', format: 'uuid' },
    customer_id: { type: 'string', format: 'uuid' },
    assigned_staff_id: { type: 'string', format: 'uuid', nullable: true },
    title: { type: 'string', example: 'Water Heater Estimate' },
    description: { type: 'string', example: 'Estimate for replacement and install' },
    scheduled_estimate_date: { type: 'string', format: 'date-time', nullable: true },
    price_book_item_id: { type: 'string', format: 'uuid', nullable: true },
    is_emergency: { type: 'boolean', example: false },
  },
};

const quoteUpdateSchema = {
  type: 'object',
  properties: {
    assigned_staff_id: { type: 'string', format: 'uuid', nullable: true },
    title: { type: 'string' },
    description: { type: 'string' },
    scheduled_estimate_date: { type: 'string', format: 'date-time', nullable: true },
    status: { type: 'string', enum: ['EstimateScheduled', 'Draft', 'Sent', 'Approved', 'Declined', 'Expired'] },
    total_amount: { type: 'number', nullable: true },
  },
};

const customerCreateSchema = {
  type: 'object',
  required: ['business_id', 'first_name', 'last_name'],
  properties: {
    business_id: { type: 'string', format: 'uuid' },
    first_name: { type: 'string', example: 'Sarah' },
    last_name: { type: 'string', example: 'Johnson' },
    phone_number: { type: 'string', example: '+15550101010' },
    email: { type: 'string', format: 'email', nullable: true },
    address: { type: 'string', nullable: true },
    zip_code: { type: 'string', nullable: true },
    notes: { type: 'string', nullable: true },
  },
};

const invoiceCreateSchema = {
  type: 'object',
  required: ['business_id', 'job_id'],
  properties: {
    business_id: { type: 'string', format: 'uuid' },
    job_id: { type: 'string', format: 'uuid' },
    due_date: { type: 'string', format: 'date-time', nullable: true },
    notes: { type: 'string', nullable: true },
    internal_notes: { type: 'string', nullable: true },
  },
};

const invoiceUpdateSchema = {
  type: 'object',
  properties: {
    due_date: { type: 'string', format: 'date-time', nullable: true },
    notes: { type: 'string', nullable: true },
    internal_notes: { type: 'string', nullable: true },
    status: {
      type: 'string',
      enum: ['Draft', 'Sent', 'PartiallyPaid', 'Paid', 'Overdue', 'Refunded', 'Voided', 'Cancelled'],
    },
  },
};

const paymentSchema = {
  type: 'object',
  required: ['amount'],
  properties: {
    amount: { type: 'number', example: 250 },
    payment_method: { type: 'string', example: 'manual' },
    paid_at: { type: 'string', format: 'date-time', nullable: true },
    reference: { type: 'string', nullable: true },
  },
};

const followUpSchema = {
  type: 'object',
  properties: {
    business_id: { type: 'string', format: 'uuid' },
    type: { type: 'string', enum: ['Quote', 'Invoice', 'Job'], example: 'Quote' },
    reference_id: { type: 'string', format: 'uuid' },
    customer_id: { type: 'string', format: 'uuid' },
    scheduled_for: { type: 'string', format: 'date-time' },
    channel: { type: 'string', example: 'SMS' },
    status: { type: 'string', example: 'Scheduled' },
    notes: { type: 'string', nullable: true },
  },
};

const teamCheckinSchema = {
  type: 'object',
  properties: {
    staff_id: { type: 'string', format: 'uuid' },
    job_id: { type: 'string', format: 'uuid', nullable: true },
    scheduled_at: { type: 'string', format: 'date-time' },
    status: { type: 'string', example: 'Pending' },
    notes: { type: 'string', nullable: true },
  },
};

const smsSendSchema = {
  type: 'object',
  required: ['business_id', 'to', 'message'],
  properties: {
    business_id: { type: 'string', format: 'uuid' },
    to: { type: 'string', example: '+15550101010' },
    message: { type: 'string', example: 'Your technician is on the way.' },
  },
};

const radiusCheckSchema = {
  type: 'object',
  required: ['business_id', 'customer_zip'],
  properties: {
    business_id: { type: 'string', format: 'uuid' },
    customer_zip: { type: 'string', example: '75001' },
  },
};

const aiPaths = {
  '/api/internal/ai/sms/incoming': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Receive inbound SMS from provider webhook',
      requestBody: requestBody(ref('AIBridgeInboundSmsInput')),
      responses: { 200: jsonResponse('Inbound SMS accepted', ref('AIBridgeWebhookResponse')) },
    },
  },
  '/api/internal/ai/calls/incoming': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Receive inbound call from provider webhook',
      requestBody: requestBody(ref('AIBridgeInboundCallInput')),
      responses: { 200: jsonResponse('Inbound call accepted', ref('AIBridgeWebhookResponse')) },
    },
  },
  '/api/internal/ai/calls/status': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Receive inbound call status update',
      requestBody: requestBody(ref('AIBridgeCallStatusInput')),
      responses: { 200: jsonResponse('Call status accepted', ref('AIBridgeWebhookResponse')) },
    },
  },
  '/api/internal/ai/schedule': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List scheduled jobs for AI dispatch',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('start_date', 'Schedule start datetime'),
        queryParam('end_date', 'Schedule end datetime'),
      ],
      responses: { 200: jsonResponse('Schedule list', paginationResponse) },
    },
  },
  '/api/internal/ai/jobs': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List jobs for AI workflows',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('assigned_staff_id', 'Filter by assigned staff', false, 'string', 'uuid'),
        queryParam('status', 'Filter by status'),
        queryParam('type', 'Filter by job type'),
        queryParam('customer_id', 'Filter by customer', false, 'string', 'uuid'),
        queryParam('start_date', 'Scheduled start lower bound'),
        queryParam('end_date', 'Scheduled end upper bound'),
        queryParam('search', 'Search title, service type, customer, address'),
        queryParam('page', 'Page number', false, 'integer'),
        queryParam('limit', 'Page size', false, 'integer'),
      ],
      responses: { 200: jsonResponse('Job list', paginationResponse) },
    },
    post: {
      tags: ['AI Bridge'],
      summary: 'Create a job through the AI bridge',
      security: secured,
      requestBody: requestBody(jobWriteSchema),
      responses: { 201: jsonResponse('Job created', ref('Job')) },
    },
  },
  '/api/internal/ai/jobs/{id}': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get one job',
      security: secured,
      parameters: [pathParam('id', 'Job identifier')],
      responses: { 200: jsonResponse('Job detail', ref('Job')) },
    },
    patch: {
      tags: ['AI Bridge'],
      summary: 'Update one job',
      security: secured,
      parameters: [pathParam('id', 'Job identifier')],
      requestBody: requestBody(jobUpdateSchema),
      responses: { 200: jsonResponse('Job updated', ref('Job')) },
    },
  },
  '/api/internal/ai/jobs/{id}/start': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Start a job',
      security: secured,
      parameters: [pathParam('id', 'Job identifier')],
      responses: { 200: jsonResponse('Job started', ref('Job')) },
    },
  },
  '/api/internal/ai/jobs/{id}/complete': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Complete a job',
      security: secured,
      parameters: [pathParam('id', 'Job identifier')],
      responses: { 200: jsonResponse('Job completed', ref('Job')) },
    },
  },
  '/api/internal/ai/staff': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List staff members for scheduling and dispatch',
      security: secured,
      parameters: [queryParam('business_id', 'Business identifier', true, 'string', 'uuid')],
      responses: { 200: jsonResponse('Staff list', { type: 'array', items: genericObject }) },
    },
  },
  '/api/internal/ai/staff/{id}': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get one staff member',
      security: secured,
      parameters: [pathParam('id', 'Staff identifier')],
      responses: { 200: jsonResponse('Staff detail', genericObject) },
    },
  },
  '/api/internal/ai/staff/availability': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Check staff availability for a time window',
      security: secured,
      parameters: [
        queryParam('staff_id', 'Staff identifier', true, 'string', 'uuid'),
        queryParam('start_time', 'Window start', true),
        queryParam('end_time', 'Window end', true),
        queryParam('exclude_job_id', 'Optional job ID to exclude when editing/rescheduling', false, 'string', 'uuid'),
      ],
      responses: { 200: jsonResponse('Availability result', genericObject) },
    },
  },
  '/api/internal/ai/quotes': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List quotes for AI workflows',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('assigned_staff_id', 'Filter by assigned staff', false, 'string', 'uuid'),
        queryParam('status', 'Filter by status'),
        queryParam('customer_id', 'Filter by customer', false, 'string', 'uuid'),
        queryParam('start_date', 'Date lower bound'),
        queryParam('end_date', 'Date upper bound'),
        queryParam('search', 'Search title, description, customer'),
        queryParam('page', 'Page number', false, 'integer'),
        queryParam('limit', 'Page size', false, 'integer'),
      ],
      responses: { 200: jsonResponse('Quote list', paginationResponse) },
    },
    post: {
      tags: ['AI Bridge'],
      summary: 'Create a quote through the AI bridge',
      security: secured,
      requestBody: requestBody(quoteWriteSchema),
      responses: { 201: jsonResponse('Quote created', ref('Quote')) },
    },
  },
  '/api/internal/ai/quotes/{id}': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get one quote',
      security: secured,
      parameters: [pathParam('id', 'Quote identifier')],
      responses: { 200: jsonResponse('Quote detail', ref('Quote')) },
    },
    patch: {
      tags: ['AI Bridge'],
      summary: 'Update one quote',
      security: secured,
      parameters: [pathParam('id', 'Quote identifier')],
      requestBody: requestBody(quoteUpdateSchema),
      responses: { 200: jsonResponse('Quote updated', ref('Quote')) },
    },
  },
  '/api/internal/ai/quotes/{id}/send': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Send a quote',
      security: secured,
      parameters: [pathParam('id', 'Quote identifier')],
      responses: { 200: jsonResponse('Quote sent', ref('Quote')) },
    },
  },
  '/api/internal/ai/quotes/{id}/approve': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Approve a quote',
      security: secured,
      parameters: [pathParam('id', 'Quote identifier')],
      responses: { 200: jsonResponse('Quote approved', genericObject) },
    },
  },
  '/api/internal/ai/quotes/{id}/decline': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Decline a quote',
      security: secured,
      parameters: [pathParam('id', 'Quote identifier')],
      responses: { 200: jsonResponse('Quote declined', genericObject) },
    },
  },
  '/api/internal/ai/customers': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List customers',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('page', 'Page number', false, 'integer'),
        queryParam('limit', 'Page size', false, 'integer'),
        queryParam('search', 'Search query'),
      ],
      responses: { 200: jsonResponse('Customer list', paginationResponse) },
    },
    post: {
      tags: ['AI Bridge'],
      summary: 'Create a customer',
      security: secured,
      requestBody: requestBody(customerCreateSchema),
      responses: { 201: jsonResponse('Customer created', ref('Customer')) },
    },
  },
  '/api/internal/ai/customers/lookup': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Look up customer by phone number',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('phone', 'Customer phone number', true),
      ],
      responses: { 200: jsonResponse('Customer lookup result', genericObject) },
    },
  },
  '/api/internal/ai/customers/{id}': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get one customer',
      security: secured,
      parameters: [pathParam('id', 'Customer identifier')],
      responses: { 200: jsonResponse('Customer detail', ref('Customer')) },
    },
  },
  '/api/internal/ai/customers/{id}/history': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get customer history',
      security: secured,
      parameters: [pathParam('id', 'Customer identifier')],
      responses: { 200: jsonResponse('Customer history', genericObject) },
    },
  },
  '/api/internal/ai/inventory': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List inventory materials',
      security: secured,
      parameters: [queryParam('business_id', 'Business identifier', true, 'string', 'uuid')],
      responses: { 200: jsonResponse('Inventory list', paginationResponse) },
    },
  },
  '/api/internal/ai/price-book': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List price book items',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('category_id', 'Optional category filter', false, 'string', 'uuid'),
        queryParam('search', 'Search term'),
        queryParam('can_quote_phone', 'Filter phone-quotable services', false, 'boolean'),
      ],
      responses: { 200: jsonResponse('Price book items', paginationResponse) },
    },
  },
  '/api/internal/ai/price-book/{id}': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get one price book item',
      security: secured,
      parameters: [pathParam('id', 'Price book item identifier')],
      responses: { 200: jsonResponse('Price book item', ref('PriceBookItem')) },
    },
  },
  '/api/internal/ai/invoices': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List invoices',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('status', 'Filter by invoice status'),
        queryParam('page', 'Page number', false, 'integer'),
        queryParam('limit', 'Page size', false, 'integer'),
      ],
      responses: { 200: jsonResponse('Invoice list', paginationResponse) },
    },
    post: {
      tags: ['AI Bridge'],
      summary: 'Create an invoice',
      security: secured,
      requestBody: requestBody(invoiceCreateSchema),
      responses: { 201: jsonResponse('Invoice created', ref('Invoice')) },
    },
  },
  '/api/internal/ai/invoices/{id}': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get one invoice',
      security: secured,
      parameters: [pathParam('id', 'Invoice identifier')],
      responses: { 200: jsonResponse('Invoice detail', ref('Invoice')) },
    },
    patch: {
      tags: ['AI Bridge'],
      summary: 'Update one invoice',
      security: secured,
      parameters: [pathParam('id', 'Invoice identifier')],
      requestBody: requestBody(invoiceUpdateSchema),
      responses: { 200: jsonResponse('Invoice updated', ref('Invoice')) },
    },
  },
  '/api/internal/ai/invoices/{id}/total': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get invoice totals',
      security: secured,
      parameters: [pathParam('id', 'Invoice identifier')],
      responses: { 200: jsonResponse('Invoice totals', genericObject) },
    },
  },
  '/api/internal/ai/invoices/{id}/send': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Send invoice to customer',
      security: secured,
      parameters: [pathParam('id', 'Invoice identifier')],
      responses: { 200: jsonResponse('Invoice sent', ref('Invoice')) },
    },
  },
  '/api/internal/ai/invoices/{id}/void': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Void invoice',
      security: secured,
      parameters: [pathParam('id', 'Invoice identifier')],
      responses: { 200: jsonResponse('Invoice voided', ref('Invoice')) },
    },
  },
  '/api/internal/ai/invoices/{id}/refund': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Refund invoice',
      security: secured,
      parameters: [pathParam('id', 'Invoice identifier')],
      responses: { 200: jsonResponse('Invoice refunded', ref('Invoice')) },
    },
  },
  '/api/internal/ai/payments/{invoiceId}': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Record payment for invoice',
      security: secured,
      parameters: [pathParam('invoiceId', 'Invoice identifier')],
      requestBody: requestBody(paymentSchema),
      responses: { 201: jsonResponse('Payment recorded', ref('Payment')) },
    },
  },
  '/api/internal/ai/follow-ups': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List follow-ups',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('status', 'Filter by status'),
        queryParam('customer_id', 'Filter by customer', false, 'string', 'uuid'),
      ],
      responses: { 200: jsonResponse('Follow-up list', paginationResponse) },
    },
    post: {
      tags: ['AI Bridge'],
      summary: 'Create a follow-up',
      security: secured,
      requestBody: requestBody(followUpSchema),
      responses: { 201: jsonResponse('Follow-up created', genericObject) },
    },
  },
  '/api/internal/ai/follow-ups/{id}': {
    patch: {
      tags: ['AI Bridge'],
      summary: 'Update a follow-up',
      security: secured,
      parameters: [pathParam('id', 'Follow-up identifier')],
      requestBody: requestBody(followUpSchema),
      responses: { 200: jsonResponse('Follow-up updated', genericObject) },
    },
  },
  '/api/internal/ai/follow-ups/{id}/sent': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Mark follow-up as sent',
      security: secured,
      parameters: [pathParam('id', 'Follow-up identifier')],
      responses: { 200: jsonResponse('Follow-up marked sent', genericObject) },
    },
  },
  '/api/internal/ai/follow-ups/{id}/cancel': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Cancel follow-up',
      security: secured,
      parameters: [pathParam('id', 'Follow-up identifier')],
      responses: { 200: jsonResponse('Follow-up cancelled', genericObject) },
    },
  },
  '/api/internal/ai/team-checkins': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List team check-ins',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('staff_id', 'Filter by staff', false, 'string', 'uuid'),
        queryParam('job_id', 'Filter by job', false, 'string', 'uuid'),
        queryParam('status', 'Filter by status'),
        queryParam('start_date', 'Date lower bound'),
        queryParam('end_date', 'Date upper bound'),
      ],
      responses: { 200: jsonResponse('Team check-in list', paginationResponse) },
    },
    post: {
      tags: ['AI Bridge'],
      summary: 'Create a team check-in',
      security: secured,
      requestBody: requestBody(teamCheckinSchema),
      responses: { 201: jsonResponse('Team check-in created', genericObject) },
    },
  },
  '/api/internal/ai/team-checkins/{id}': {
    patch: {
      tags: ['AI Bridge'],
      summary: 'Update a team check-in',
      security: secured,
      parameters: [pathParam('id', 'Team check-in identifier')],
      requestBody: requestBody(teamCheckinSchema),
      responses: { 200: jsonResponse('Team check-in updated', genericObject) },
    },
  },
  '/api/internal/ai/team-checkins/{id}/receive': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Mark team check-in received',
      security: secured,
      parameters: [pathParam('id', 'Team check-in identifier')],
      responses: { 200: jsonResponse('Team check-in received', genericObject) },
    },
  },
  '/api/internal/ai/team-checkins/{id}/escalate': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Escalate missed team check-in',
      security: secured,
      parameters: [pathParam('id', 'Team check-in identifier')],
      responses: { 200: jsonResponse('Team check-in escalated', genericObject) },
    },
  },
  '/api/internal/ai/dashboard/summary': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get AI-side dashboard summary',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('period', 'Dashboard period', false),
      ],
      responses: { 200: jsonResponse('Dashboard summary', ref('DashboardSummary')) },
    },
  },
  '/api/internal/ai/events': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List activity events',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('event_type', 'Filter by event type'),
        queryParam('customer_id', 'Filter by customer', false, 'string', 'uuid'),
        queryParam('job_id', 'Filter by job', false, 'string', 'uuid'),
        queryParam('page', 'Page number', false, 'integer'),
        queryParam('limit', 'Page size', false, 'integer'),
      ],
      responses: { 200: jsonResponse('Event list', paginationResponse) },
    },
    post: {
      tags: ['AI Bridge'],
      summary: 'Create an activity event',
      security: secured,
      requestBody: requestBody(ref('InternalActivityEventInput')),
      responses: { 201: jsonResponse('Event created', ref('InternalActivityEvent')) },
    },
  },
  '/api/internal/ai/events/event-types': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List distinct event types',
      security: secured,
      parameters: [queryParam('business_id', 'Business identifier', true, 'string', 'uuid')],
      responses: { 200: jsonResponse('Event types', ref('InternalEventTypeListResponse')) },
    },
  },
  '/api/internal/ai/conversations': {
    get: {
      tags: ['AI Bridge'],
      summary: 'List grouped customer conversations',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('channel', 'Filter by channel'),
        queryParam('search', 'Search customer or latest activity'),
        queryParam('page', 'Page number', false, 'integer'),
        queryParam('limit', 'Page size', false, 'integer'),
      ],
      responses: { 200: jsonResponse('Conversation list', ref('ConversationListResponse')) },
    },
  },
  '/api/internal/ai/conversations/{customer_id}': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get conversation detail for one customer',
      security: secured,
      parameters: [
        pathParam('customer_id', 'Customer identifier'),
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
      ],
      responses: { 200: jsonResponse('Conversation detail', ref('ConversationDetailResponse')) },
    },
  },
  '/api/internal/ai/price-lookup': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Lookup services for AI quoting logic',
      security: secured,
      parameters: [
        queryParam('business_id', 'Business identifier', true, 'string', 'uuid'),
        queryParam('search', 'Search text'),
        queryParam('service', 'Alternative search text'),
        queryParam('category_id', 'Category filter', false, 'string', 'uuid'),
        queryParam('can_quote_phone', 'Filter phone-quotable services', false, 'boolean'),
        queryParam('limit', 'Max items', false, 'integer'),
      ],
      responses: { 200: jsonResponse('Price lookup result', ref('AIPriceLookupResponse')) },
    },
  },
  '/api/internal/ai/radius-check': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Check whether a customer zip is inside service radius',
      security: secured,
      requestBody: requestBody(radiusCheckSchema),
      responses: { 200: jsonResponse('Radius check result', genericObject) },
    },
  },
  '/api/internal/ai/book': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Book a quote, job, or service call from AI',
      security: secured,
      requestBody: requestBody(ref('AIBookingInput')),
      responses: { 201: jsonResponse('Booking result', ref('AIBookingResponse')) },
    },
  },
  '/api/internal/ai/business-config': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get full AI business operating config',
      security: secured,
      parameters: [queryParam('business_id', 'Business identifier', true, 'string', 'uuid')],
      responses: { 200: jsonResponse('AI business config', ref('AIBusinessConfigResponse')) },
    },
  },
  '/api/internal/ai/business/profile': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get business profile for AI',
      security: secured,
      parameters: [queryParam('business_id', 'Business identifier', true, 'string', 'uuid')],
      responses: { 200: jsonResponse('Business profile', ref('BusinessProfileResponse')) },
    },
  },
  '/api/internal/ai/business/alerts': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get alert settings for AI',
      security: secured,
      parameters: [queryParam('business_id', 'Business identifier', true, 'string', 'uuid')],
      responses: { 200: jsonResponse('Alert settings', ref('BusinessAlertSettingsResponse')) },
    },
  },
  '/api/internal/ai/business/automation': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get automation settings for AI',
      security: secured,
      parameters: [queryParam('business_id', 'Business identifier', true, 'string', 'uuid')],
      responses: { 200: jsonResponse('Automation settings', ref('BusinessAutomationSettingsResponse')) },
    },
  },
  '/api/internal/ai/business/communication': {
    get: {
      tags: ['AI Bridge'],
      summary: 'Get communication settings for AI',
      security: secured,
      parameters: [queryParam('business_id', 'Business identifier', true, 'string', 'uuid')],
      responses: { 200: jsonResponse('Communication settings', ref('BusinessCommunicationSettingsResponse')) },
    },
  },
  '/api/internal/ai/sms/send': {
    post: {
      tags: ['AI Bridge'],
      summary: 'Send outbound SMS through AI bridge',
      security: secured,
      requestBody: requestBody(smsSendSchema),
      responses: { 200: jsonResponse('SMS send result', genericObject) },
    },
  },
};

function resolveSchema(schema, components, seen = new Set()) {
  if (!schema) return null;

  if (schema.$ref) {
    const name = schema.$ref.split('/').pop();
    if (seen.has(name)) return {};
    seen.add(name);
    return resolveSchema(components.schemas[name], components, seen);
  }

  if (schema.allOf) {
    return schema.allOf.reduce((acc, item) => {
      const resolved = resolveSchema(item, components, new Set(seen));
      if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) {
        return { ...acc, ...resolved };
      }
      return acc;
    }, {});
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.enum && schema.enum.length) {
    return schema.enum[0];
  }

  switch (schema.type) {
    case 'object': {
      const result = {};
      for (const [key, value] of Object.entries(schema.properties || {})) {
        result[key] = resolveSchema(value, components, new Set(seen));
      }
      return result;
    }
    case 'array':
      return [resolveSchema(schema.items, components, new Set(seen))];
    case 'integer':
      return 1;
    case 'number':
      return 1;
    case 'boolean':
      return true;
    case 'string':
    default:
      if (schema.format === 'uuid') return '{{uuid}}';
      if (schema.format === 'date-time') return '2026-04-07T10:00:00.000Z';
      if (schema.format === 'email') return 'user@example.com';
      return 'string';
  }
}

function collectVariables(paths) {
  const vars = new Set(['baseUrl', 'internalApiKey', 'businessToken', 'business_id']);
  for (const [route, methods] of Object.entries(paths)) {
    const matches = route.match(/\{([^}]+)\}/g) || [];
    for (const match of matches) vars.add(match.slice(1, -1));
    for (const operation of Object.values(methods)) {
      for (const parameter of operation.parameters || []) {
        vars.add(parameter.name);
      }
    }
  }
  return Array.from(vars).sort();
}

function routeGroup(route) {
  const stripped = route.replace('/api/internal/ai/', '');
  const segment = stripped.split('/')[0];
  const labels = {
    sms: 'SMS',
    calls: 'Calls',
    schedule: 'Schedule',
    jobs: 'Jobs',
    staff: 'Staff',
    quotes: 'Quotes',
    customers: 'Customers',
    inventory: 'Inventory',
    'price-book': 'Price Book',
    invoices: 'Invoices',
    payments: 'Payments',
    'follow-ups': 'Follow-Ups',
    'team-checkins': 'Team Check-Ins',
    dashboard: 'Dashboard',
    events: 'Events',
    conversations: 'Conversations',
    'price-lookup': 'AI Tools',
    'radius-check': 'AI Tools',
    book: 'AI Tools',
    'business-config': 'AI Tools',
    business: 'Business Settings',
  };
  return labels[segment] || 'AI Bridge';
}

function pathToPostman(route) {
  return route.replace(/\{([^}]+)\}/g, '{{$1}}');
}

function buildRequestName(method, route, summary) {
  return `${method.toUpperCase()} ${summary || route}`;
}

function buildPostmanItem(route, method, operation, components) {
  const headers = [];
  const hasBody = Boolean(operation.requestBody);

  if (hasBody) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
  }

  if (operation.security && operation.security.length) {
    headers.push({ key: 'x-api-key', value: '{{internalApiKey}}' });
    headers.push({ key: 'x-business-token', value: '{{businessToken}}' });
  }

  const query = [];
  for (const parameter of operation.parameters || []) {
    if (parameter.in === 'query') {
      query.push({
        key: parameter.name,
        value: `{{${parameter.name}}}`,
        disabled: !parameter.required,
        description: parameter.description || '',
      });
    }
  }

  let body;
  if (hasBody) {
    const media = operation.requestBody.content['application/json'];
    const sample = resolveSchema(media.schema, components);
    body = {
      mode: 'raw',
      raw: JSON.stringify(sample, null, 2),
      options: { raw: { language: 'json' } },
    };
  }

  return {
    name: buildRequestName(method, route, operation.summary),
    request: {
      method: method.toUpperCase(),
      header: headers,
      url: {
        raw: `{{baseUrl}}${pathToPostman(route)}`,
        host: ['{{baseUrl}}'],
        path: pathToPostman(route).replace(/^\//, '').split('/'),
        query,
      },
      description: operation.description || operation.summary || '',
      ...(body ? { body } : {}),
    },
  };
}

function buildPostmanCollection(openApiSpec) {
  const grouped = new Map();

  for (const [route, methods] of Object.entries(openApiSpec.paths)) {
    const group = routeGroup(route);
    if (!grouped.has(group)) grouped.set(group, []);

    for (const [method, operation] of Object.entries(methods)) {
      grouped.get(group).push(buildPostmanItem(route, method, operation, openApiSpec.components));
    }
  }

  const item = Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, requests]) => ({
      name,
      item: requests,
    }));

  const variable = collectVariables(openApiSpec.paths).map((key) => ({
    key,
    value: key === 'baseUrl' ? 'http://localhost:3000' : '',
  }));

  return {
    info: {
      name: 'Ajicore AI Integration API',
      description: 'AI-focused Postman collection generated from the Ajicore internal AI OpenAPI spec.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable,
    item,
  };
}

function buildAiOpenApiSpec() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Ajicore AI Integration API',
      version: swaggerSpec.info?.version || '2.0.0',
      description: [
        'AI-only OpenAPI export for the canonical internal AI bridge.',
        '',
        'Authentication:',
        '- Protected AI routes require both `x-api-key` and `x-business-token`.',
        '- Provider webhook routes under `/api/internal/ai/sms/incoming` and `/api/internal/ai/calls/*` do not require those headers.',
        '',
        'Business owners can retrieve `x-business-token` from `GET /api/auth/internal-api-token?business_id=...` in the main API.',
      ].join('\n'),
    },
    servers: swaggerSpec.servers || [{ url: 'http://localhost:3000', description: 'Development' }],
    tags: (swaggerSpec.tags || []).filter((tag) => tag.name === 'AI Bridge'),
    components: swaggerSpec.components,
    paths: aiPaths,
  };
}

fs.mkdirSync(path.dirname(OUTPUT_OPENAPI), { recursive: true });

const aiOpenApiSpec = buildAiOpenApiSpec();
const postmanCollection = buildPostmanCollection(aiOpenApiSpec);

fs.writeFileSync(OUTPUT_OPENAPI, `${JSON.stringify(aiOpenApiSpec, null, 2)}\n`);
fs.writeFileSync(OUTPUT_POSTMAN, `${JSON.stringify(postmanCollection, null, 2)}\n`);

console.log(`Wrote ${OUTPUT_OPENAPI}`);
console.log(`Wrote ${OUTPUT_POSTMAN}`);
