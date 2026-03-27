/**
 * Swagger / OpenAPI 3.0 Configuration
 * Access docs at: GET /api/docs
 * Download JSON for Postman at: GET /api/docs.json
 */
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ajicore API',
      version: '2.0.0',
      description: `
# Ajicore — AI-Powered Back Office for Blue-Collar Service Businesses

Complete REST API for managing schedules, quotes, jobs, invoicing, inventory, fleet, staff, and AI call flow.

## Authentication
- **Frontend routes**: Use \`Authorization: Bearer <jwt_token>\` header

- **AI / Internal routes**: Use both \`x-api-key: <internal_api_key>\` and \`x-business-token: <business_internal_api_token>\`

## Key Flows

### Quote → Job Conversion
1. AI books estimate → \`POST /api/quotes\` (status: EstimateScheduled)

2. Contractor goes on-site → \`PATCH /api/quotes/:id\` (add pricing, status: Draft)

3. Send to customer → \`POST /api/quotes/:id/send\` (status: Sent, expiry set)

4. Customer approves → \`POST /api/quotes/:id/approve\` (creates Job)

### Direct Job Booking (price known)
1. AI/manual books job → \`POST /api/jobs\`

2. Start work → \`POST /api/jobs/:id/start\`

3. Complete → \`POST /api/jobs/:id/complete\`

4. Invoice → \`POST /api/billing/invoices\`

5. Payment → \`POST /api/billing/payments/:invoiceId\`

### Invoice Edit Rules

- **Draft/Sent**: Full edit allowed

- **Paid**: Only internal notes

- **Refunded/Voided**: Locked
      `,
      contact: { name: 'Ajicore Team' },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from /api/auth/signin or /api/auth/signup',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Internal API key for AI service endpoints',
        },
        businessTokenAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-business-token',
          description: 'Per-business internal bridge token, retrievable by the business owner from /api/auth/internal-api-token',
        },
      },
      schemas: {
        Business: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            industry: { type: 'string' },
            owner_id: { type: 'string', format: 'uuid', nullable: true },
            business_structure: { type: 'string', nullable: true },
            company_email: { type: 'string', format: 'email', nullable: true },
            company_type: { type: 'string', nullable: true },
            company_phone: { type: 'string', nullable: true },
            ai_phone_number: { type: 'string', nullable: true },
            home_base_zip: { type: 'string', nullable: true },
            service_radius_miles: { type: 'number', nullable: true },
            cost_per_mile_over_radius: { type: 'number', nullable: true },
            quote_expiry_days: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        InternalApiTokenResponse: {
          type: 'object',
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            internal_api_token: { type: 'string' },
          },
        },
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            business_id: { type: 'string' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            phone_number: { type: 'string' },
            email: { type: 'string' },
            address: { type: 'string' },
            zip_code: { type: 'string' },
            notes: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Job: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            business_id: { type: 'string' },
            customer_id: { type: 'string' },
            assigned_staff_id: { type: 'string', nullable: true },
            type: { type: 'string', enum: ['Job', 'ServiceCall'] },
            status: { type: 'string', enum: ['Scheduled', 'InProgress', 'Completed', 'Invoiced', 'Cancelled'] },
            title: { type: 'string' },
            job_details: { type: 'string' },
            service_call_fee: { type: 'number', nullable: true },
            scheduled_start_time: { type: 'string', format: 'date-time', nullable: true },
            actual_start_time: { type: 'string', format: 'date-time', nullable: true },
            actual_end_time: { type: 'string', format: 'date-time', nullable: true },
            is_emergency: { type: 'boolean' },
            source: { type: 'string', enum: ['AI', 'Manual', 'SMS'] },
          },
        },
        Quote: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            business_id: { type: 'string' },
            customer_id: { type: 'string' },
            status: { type: 'string', enum: ['EstimateScheduled', 'Draft', 'Sent', 'Approved', 'Declined', 'Expired'] },
            title: { type: 'string' },
            total_amount: { type: 'number', nullable: true, description: 'null = TBD until approved' },
            expires_at: { type: 'string', format: 'date-time', nullable: true },
            converted_to_job_id: { type: 'string', nullable: true },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            job_id: { type: 'string' },
            status: { type: 'string', enum: ['Draft', 'Sent', 'PartiallyPaid', 'Paid', 'Overdue', 'Refunded', 'Voided', 'Cancelled'] },
            notes: { type: 'string' },
            internal_notes: { type: 'string' },
            due_date: { type: 'string', format: 'date-time' },
            line_items: { type: 'array', items: { $ref: '#/components/schemas/InvoiceLine' } },
          },
        },
        InvoiceLine: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            description: { type: 'string' },
            quantity: { type: 'number' },
            unit_price: { type: 'number' },
            total: { type: 'number' },
            is_credit: { type: 'boolean', description: 'true = deduction (e.g., service call credit)' },
          },
        },
              Payment: {
        type: 'object',
        properties: {
          invoice_id: { type: 'string' },
          amount: { type: 'number' },
          method: { type: 'string' },
          status: { type: 'string' }
        }
      },

        Expense: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            business_id: { type: 'string' },
            amount: { type: 'number' },
            category: { type: 'string' },
            description: { type: 'string' },
            job_id: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        PriceBookItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            can_quote_phone: { type: 'boolean' },
            price_type: { type: 'string', enum: ['Fixed', 'Range', 'NeedsOnsite'] },
            price: { type: 'number', nullable: true },
            price_min: { type: 'number', nullable: true },
            price_max: { type: 'number', nullable: true },
            visit_type: { type: 'string', enum: ['FreeEstimate', 'PaidServiceCall'] },
            service_call_fee: { type: 'number', nullable: true },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            data: { type: 'array', items: {} },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication and onboarding' },
      { name: 'Customers', description: 'Customer management' },
      { name: 'Quotes', description: 'Quote lifecycle (EstimateScheduled → Approved → Job)' },
      { name: 'Jobs', description: 'Job management (Scheduled → Completed → Invoiced)' },
      { name: 'Billing', description: 'Invoices, payments, and expenses' },
      { name: 'PriceBook', description: 'Service categories and price book' },
      { name: 'Inventory', description: 'Materials and inventory' },
      { name: 'Fleet', description: 'Vehicle and fleet management' },
      { name: 'Staff', description: 'Staff, timesheets, and payroll' },
      { name: 'Dashboard', description: 'Analytics and reporting' },
      { name: 'AI Bridge', description: 'Internal AI service API (x-api-key required; business-scoped routes also require x-business-token)' },
    ],
  },
  apis: [
    './src/api/routes/*.js',
    './src/api/routes/docs/*swagger.js',
    './src/domains/**/*.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
