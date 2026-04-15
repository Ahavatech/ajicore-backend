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

## Page Guide

- **Auth**: sign in, sign up, password reset, current user, internal token
- **Onboarding**: business info, OTP verification, AI number setup, service area, finish setup
- **Dashboard**: summary, revenue, jobs analytics, weekly report
- **Jobs**: jobs list, job detail, lifecycle actions, materials, photos
- **Schedule**: schedule/calendar reads and availability checks
- **Quotes**: estimates, approvals, declines, and sending
- **Customers**: customer list, lookup, detail, and history
- **Conversations**: recent calls and SMS history
- **Team**: staff list, detail, payroll, timesheets, and clock-in/out
- **Team Check-Ins**: field check-ins and escalations
- **Follow-Ups**: reminder and follow-up records
- **Business Profile / Alerts / Automation / Communication**: settings pages
- **Billing / Payments / Expenses**: invoices, payments, and expense tracking
- **PriceBook**: service categories and quoteable items
- **Inventory**: materials, restocks, and deductions
- **Fleet**: vehicles and maintenance alerts
- **Bookkeeping**: transactions and categorization rules
- **AI Logs**: event log inspection
- **AI Bridge**: internal AI/receptionist integration surface

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
        AuthForgotPasswordInput: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
        AuthForgotPasswordResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            dev_reset_code: { type: 'string', nullable: true },
          },
        },
        AuthVerifyResetCodeInput: {
          type: 'object',
          required: ['email', 'code'],
          properties: {
            email: { type: 'string', format: 'email' },
            code: { type: 'string' },
          },
        },
        AuthVerifyResetCodeResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            valid: { type: 'boolean' },
          },
        },
        AuthResetPasswordInput: {
          type: 'object',
          required: ['email', 'code', 'new_password'],
          properties: {
            email: { type: 'string', format: 'email' },
            code: { type: 'string' },
            new_password: { type: 'string', minLength: 8 },
          },
        },
        AuthResetPasswordResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
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
        JobAvailabilityConflict: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string', nullable: true },
            service_type: { type: 'string', nullable: true },
            status: { type: 'string', example: 'Scheduled' },
            address: { type: 'string', nullable: true },
            scheduled_start_time: { type: 'string', format: 'date-time', nullable: true },
            scheduled_end_time: { type: 'string', format: 'date-time', nullable: true },
            customer: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                first_name: { type: 'string', nullable: true },
                last_name: { type: 'string', nullable: true },
              },
            },
            assigned_staff: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string', nullable: true },
                role: { type: 'string', nullable: true },
              },
            },
          },
        },
        JobAvailabilityResponse: {
          type: 'object',
          properties: {
            available: { type: 'boolean', example: false },
            staff_id: { type: 'string', format: 'uuid' },
            requested_window: {
              type: 'object',
              properties: {
                start_time: { type: 'string', format: 'date-time' },
                end_time: { type: 'string', format: 'date-time' },
              },
            },
            conflicts: {
              type: 'array',
              items: { $ref: '#/components/schemas/JobAvailabilityConflict' },
            },
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
        Material: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            business_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            unit: { type: 'string', nullable: true },
            quantity_on_hand: { type: 'integer' },
            restock_threshold: { type: 'integer' },
            unit_cost: { type: 'number', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        MaterialInput: {
          type: 'object',
          required: ['business_id', 'name'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            unit: { type: 'string' },
            quantity_on_hand: { type: 'integer' },
            restock_threshold: { type: 'integer' },
            unit_cost: { type: 'number' },
          },
        },
        MaterialUpdateInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            unit: { type: 'string' },
            quantity_on_hand: { type: 'integer' },
            restock_threshold: { type: 'integer' },
            unit_cost: { type: 'number' },
          },
        },
        MaterialRestockInput: {
          type: 'object',
          required: ['quantity'],
          properties: {
            quantity: { type: 'integer', minimum: 1 },
          },
        },
        JobMaterialUsageInput: {
          type: 'object',
          required: ['material_id', 'quantity'],
          properties: {
            material_id: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1 },
            unit_cost: { type: 'number', nullable: true },
          },
        },
        InventoryDeductionInput: {
          type: 'object',
          required: ['materials'],
          properties: {
            materials: {
              type: 'array',
              items: { $ref: '#/components/schemas/JobMaterialUsageInput' },
            },
          },
        },
        Vehicle: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            business_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', nullable: true },
            make_model: { type: 'string' },
            year: { type: 'integer', nullable: true },
            license_plate: { type: 'string', nullable: true },
            mileage: { type: 'integer' },
            insurance_expiry: { type: 'string', format: 'date-time', nullable: true },
            registration_renewal: { type: 'string', format: 'date-time', nullable: true },
            maintenance_cycle_miles: { type: 'integer' },
            last_maintenance_mileage: { type: 'integer' },
            notes: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        VehicleInput: {
          type: 'object',
          required: ['business_id', 'make_model'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            make_model: { type: 'string' },
            year: { type: 'integer' },
            license_plate: { type: 'string' },
            mileage: { type: 'integer' },
            insurance_expiry: { type: 'string', format: 'date-time' },
            registration_renewal: { type: 'string', format: 'date-time' },
            maintenance_cycle_miles: { type: 'integer' },
            last_maintenance_mileage: { type: 'integer' },
            notes: { type: 'string' },
          },
        },
        VehicleUpdateInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            make_model: { type: 'string' },
            year: { type: 'integer' },
            license_plate: { type: 'string' },
            mileage: { type: 'integer' },
            insurance_expiry: { type: 'string', format: 'date-time' },
            registration_renewal: { type: 'string', format: 'date-time' },
            maintenance_cycle_miles: { type: 'integer' },
            last_maintenance_mileage: { type: 'integer' },
            notes: { type: 'string' },
          },
        },
        VehicleMileageUpdateInput: {
          type: 'object',
          required: ['mileage'],
          properties: {
            mileage: { type: 'integer', minimum: 0 },
          },
        },
        VehicleMaintenanceAlert: {
          type: 'object',
          properties: {
            vehicle_id: { type: 'string', format: 'uuid' },
            make_model: { type: 'string' },
            license_plate: { type: 'string', nullable: true },
            reason: { type: 'string' },
            due_date: { type: 'string', format: 'date-time', nullable: true },
            due_mileage: { type: 'integer', nullable: true },
          },
        },
        StaffMember: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            business_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['Owner', 'Manager', 'Technician', 'Apprentice', 'Admin'] },
            hourly_rate: { type: 'number' },
            email: { type: 'string', format: 'email', nullable: true },
            phone: { type: 'string', nullable: true },
            check_in_frequency_hours: { type: 'number', nullable: true },
            active_job_id: { type: 'string', format: 'uuid', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        StaffInput: {
          type: 'object',
          required: ['business_id', 'name', 'hourly_rate'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['Owner', 'Manager', 'Technician', 'Apprentice', 'Admin'] },
            hourly_rate: { type: 'number' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            check_in_frequency_hours: { type: 'number' },
          },
        },
        StaffUpdateInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            role: { type: 'string', enum: ['Owner', 'Manager', 'Technician', 'Apprentice', 'Admin'] },
            hourly_rate: { type: 'number' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            check_in_frequency_hours: { type: 'number' },
            active_job_id: { type: 'string', format: 'uuid', nullable: true },
          },
        },
        Timesheet: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            staff_id: { type: 'string', format: 'uuid' },
            job_id: { type: 'string', format: 'uuid', nullable: true },
            clock_in: { type: 'string', format: 'date-time' },
            clock_out: { type: 'string', format: 'date-time', nullable: true },
            total_hours: { type: 'number', nullable: true },
            notes: { type: 'string', nullable: true },
          },
        },
        PayrollSummary: {
          type: 'object',
          properties: {
            staff_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            regular_hours: { type: 'number' },
            overtime_hours: { type: 'number', nullable: true },
            total_pay: { type: 'number' },
          },
        },
        QuoteInput: {
          type: 'object',
          required: ['business_id', 'customer_id'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            customer_id: { type: 'string', format: 'uuid' },
            assigned_staff_id: { type: 'string', format: 'uuid', nullable: true },
            title: { type: 'string' },
            description: { type: 'string' },
            price_book_item_id: { type: 'string', format: 'uuid', nullable: true },
            scheduled_estimate_date: { type: 'string', format: 'date-time', nullable: true },
            total_amount: { type: 'number', nullable: true },
            notes: { type: 'string', nullable: true },
            is_emergency: { type: 'boolean' },
            status: { type: 'string', enum: ['EstimateScheduled', 'Draft', 'Sent', 'Approved', 'Declined', 'Expired'] },
          },
        },
        QuoteUpdateInput: {
          type: 'object',
          properties: {
            assigned_staff_id: { type: 'string', format: 'uuid', nullable: true },
            title: { type: 'string' },
            description: { type: 'string' },
            price_book_item_id: { type: 'string', format: 'uuid', nullable: true },
            scheduled_estimate_date: { type: 'string', format: 'date-time', nullable: true },
            total_amount: { type: 'number', nullable: true },
            notes: { type: 'string', nullable: true },
            is_emergency: { type: 'boolean' },
            status: { type: 'string', enum: ['EstimateScheduled', 'Draft', 'Sent', 'Approved', 'Declined', 'Expired'] },
            expires_at: { type: 'string', format: 'date-time', nullable: true },
          },
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
        DashboardChartPoint: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'Mon' },
            value: { type: 'number', example: 1200 },
          },
        },
        DashboardTodayJob: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            time: { type: 'string', example: '09:00 AM' },
            technician: { type: 'string', example: 'Mike Davis' },
            jobType: { type: 'string', example: 'Plumbing Repair' },
            status: { type: 'string', example: 'In Progress' },
          },
        },
        DashboardPendingQuote: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            customerName: { type: 'string', example: 'Sarah Johnson' },
            jobType: { type: 'string', example: 'HVAC Installation' },
            quoteId: { type: 'string', example: 'EST-1001ABCD' },
          },
        },
        DashboardRecentActivity: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['call', 'job', 'sms', 'invoice', 'schedule'] },
            title: { type: 'string', example: 'Missed call from Sarah Johnson' },
            time: { type: 'string', example: '10 mins ago' },
          },
        },
        DashboardActiveTeamMember: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Chris Brown' },
            role: { type: 'string', example: 'Technician' },
            status: { type: 'string', enum: ['On Job', 'Traveling', 'On Break'] },
            location: { type: 'string', example: '123 Main St, Dallas TX' },
          },
        },
        DashboardSummary: {
          type: 'object',
          properties: {
            revenue: { type: 'number', example: 14250.0 },
            active_jobs: { type: 'integer', example: 12 },
            jobs_trend: { type: 'number', example: 8.5 },
            pending_invoices: { type: 'integer', example: 5 },
            overdue_invoices: { type: 'integer', example: 2 },
            calls_handled: { type: 'integer', example: 47 },
            todays_jobs: {
              type: 'array',
              items: { $ref: '#/components/schemas/DashboardTodayJob' },
            },
            pending_quotes: {
              type: 'array',
              items: { $ref: '#/components/schemas/DashboardPendingQuote' },
            },
            recent_activity: {
              type: 'array',
              items: { $ref: '#/components/schemas/DashboardRecentActivity' },
            },
            active_team: {
              type: 'array',
              items: { $ref: '#/components/schemas/DashboardActiveTeamMember' },
            },
          },
        },
        DashboardRevenue: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 14250.0 },
            trend: { type: 'number', example: 15.2 },
            chart_data: {
              type: 'array',
              items: { $ref: '#/components/schemas/DashboardChartPoint' },
            },
          },
        },
        DashboardJobsAnalytics: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['7d', '30d', '90d'], example: '7d' },
            total: { type: 'integer', example: 18 },
            by_status: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'Completed' },
                  count: { type: 'integer', example: 8 },
                },
              },
            },
            by_type: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', example: 'Job' },
                  count: { type: 'integer', example: 12 },
                },
              },
            },
            chart_data: {
              type: 'array',
              items: { $ref: '#/components/schemas/DashboardChartPoint' },
            },
          },
        },
        InternalActivityEventInput: {
          type: 'object',
          required: ['business_id', 'event_type'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            event_type: {
              type: 'string',
              example: 'call.missed',
              description: 'Must start with call., sms., job., invoice., schedule., or quote.',
            },
            title: { type: 'string', example: 'Missed call from Sarah Johnson' },
            message: { type: 'string', example: 'Customer did not answer callback attempt.' },
            actor: { type: 'string', example: 'ai-receptionist' },
            timestamp: { type: 'string', format: 'date-time' },
            job_id: { type: 'string', format: 'uuid', nullable: true },
            customer_id: { type: 'string', format: 'uuid', nullable: true },
            error: { type: 'string', nullable: true },
            details: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        InternalActivityEvent: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            business_id: { type: 'string', format: 'uuid' },
            event_type: { type: 'string', example: 'call.missed' },
            actor: { type: 'string', nullable: true },
            timestamp: { type: 'string', format: 'date-time' },
            details: {
              type: 'object',
              additionalProperties: true,
            },
            job_id: { type: 'string', format: 'uuid', nullable: true },
            customer_id: { type: 'string', format: 'uuid', nullable: true },
            error: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        InternalEventTypeListResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        AIBridgeWebhookResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            business_id: { type: 'string', format: 'uuid' },
            customer_id: { type: 'string', format: 'uuid', nullable: true },
            reply: { type: 'string', nullable: true },
            status: { type: 'string', nullable: true },
            call_sid: { type: 'string', nullable: true },
            data: {
              type: 'object',
              additionalProperties: true,
              nullable: true,
            },
          },
        },
        AIBridgeInboundSmsInput: {
          type: 'object',
          properties: {
            from: { type: 'string', example: '+15550101010' },
            to: { type: 'string', example: '+15551234567' },
            message: { type: 'string', example: 'Need help with my AC' },
            From: { type: 'string', example: '+15550101010' },
            To: { type: 'string', example: '+15551234567' },
            Body: { type: 'string', example: 'Need help with my AC' },
          },
        },
        AIBridgeInboundCallInput: {
          type: 'object',
          properties: {
            from: { type: 'string', example: '+15550101010' },
            to: { type: 'string', example: '+15551234567' },
            call_sid: { type: 'string', example: 'CA123' },
            status: { type: 'string', example: 'ringing' },
            intent: { type: 'string', example: 'schedule_service' },
            transcript: { type: 'string', nullable: true },
            recording_url: { type: 'string', nullable: true },
            duration_seconds: { type: 'integer', nullable: true },
            outcome: { type: 'string', nullable: true },
            From: { type: 'string', example: '+15550101010' },
            To: { type: 'string', example: '+15551234567' },
            CallSid: { type: 'string', example: 'CA123' },
            CallStatus: { type: 'string', example: 'ringing' },
          },
        },
        AIBridgeCallStatusInput: {
          allOf: [
            { $ref: '#/components/schemas/AIBridgeInboundCallInput' },
          ],
        },
        AIBusinessConfigResponse: {
          type: 'object',
          properties: {
            business: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                industry: { type: 'string', nullable: true },
                business_hours: {
                  type: 'object',
                  additionalProperties: true,
                  nullable: true,
                },
                timezone: { type: 'string', nullable: true },
                company_phone: { type: 'string', nullable: true },
                owner_phone: { type: 'string', nullable: true },
                dedicated_phone_number: { type: 'string', nullable: true },
                ai_phone_number: { type: 'string', nullable: true },
                ai_receptionist_name: { type: 'string', nullable: true },
                voice_gender: { type: 'string', nullable: true },
                ai_business_description: { type: 'string', nullable: true },
                home_base_zip: { type: 'string', nullable: true },
                service_radius_miles: { type: 'number', nullable: true },
                cost_per_mile_over_radius: { type: 'number', nullable: true },
                service_area_description: { type: 'string', nullable: true },
                unknown_service_handling: { type: 'string', nullable: true },
                unknown_service_call_fee: { type: 'number', nullable: true },
                quote_expiry_days: { type: 'integer', nullable: true },
                payment_follow_up_days: {
                  type: 'array',
                  items: { type: 'string' },
                },
                payment_interval: { type: 'string', nullable: true },
                alert_settings: { $ref: '#/components/schemas/BusinessAlertSettings' },
                automation_settings: { $ref: '#/components/schemas/BusinessAutomationSettings' },
                communication_settings: { $ref: '#/components/schemas/BusinessCommunicationSettings' },
              },
            },
            service_categories: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true,
              },
            },
            price_book: {
              type: 'array',
              items: { $ref: '#/components/schemas/PriceBookItem' },
            },
          },
        },
        AIPriceLookupResponse: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/PriceBookItem' },
            },
            unknown_service_handling: { type: 'string', nullable: true },
            unknown_service_call_fee: { type: 'number', nullable: true },
          },
        },
        AIBookCustomerInput: {
          type: 'object',
          properties: {
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            phone_number: { type: 'string' },
            email: { type: 'string', format: 'email', nullable: true },
            address: { type: 'string', nullable: true },
            zip_code: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
          },
        },
        AIBookingInput: {
          type: 'object',
          required: ['business_id', 'booking_type'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            booking_type: { type: 'string', enum: ['Quote', 'Job', 'ServiceCall'] },
            customer_id: { type: 'string', format: 'uuid', nullable: true },
            customer: { $ref: '#/components/schemas/AIBookCustomerInput' },
            assigned_staff_id: { type: 'string', format: 'uuid', nullable: true },
            service_name: { type: 'string', nullable: true },
            service_type: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            price_book_item_id: { type: 'string', format: 'uuid', nullable: true },
            service_call_fee: { type: 'number', nullable: true },
            scheduled_start_time: { type: 'string', format: 'date-time', nullable: true },
            scheduled_end_time: { type: 'string', format: 'date-time', nullable: true },
            is_emergency: { type: 'boolean', nullable: true },
            notes: { type: 'string', nullable: true },
          },
        },
        AIBookingResponse: {
          type: 'object',
          properties: {
            booking_type: { type: 'string', enum: ['Quote', 'Job', 'ServiceCall'] },
            result: {
              type: 'object',
              additionalProperties: true,
            },
            automation: {
              type: 'object',
              properties: {
                follow_up: {
                  type: 'object',
                  additionalProperties: true,
                  nullable: true,
                },
                team_checkin: {
                  type: 'object',
                  additionalProperties: true,
                  nullable: true,
                },
              },
            },
          },
        },
        BusinessProfile: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            industry: { type: 'string' },
            business_structure: { type: 'string' },
            company_email: { type: 'string' },
            company_type: { type: 'string' },
            company_phone: { type: 'string' },
            owner_phone: { type: 'string' },
            street: { type: 'string' },
            city: { type: 'string' },
            postal_code: { type: 'string' },
            country: { type: 'string' },
            logo_url: { type: 'string' },
            timezone: { type: 'string' },
            business_hours: {
              type: 'object',
              additionalProperties: true,
            },
            service_area_description: { type: 'string' },
            home_base_zip: { type: 'string' },
            service_radius_miles: { type: 'number', nullable: true },
            cost_per_mile_over_radius: { type: 'number', nullable: true },
            dedicated_phone_number: { type: 'string' },
            ai_phone_number: { type: 'string' },
            ai_phone_country: { type: 'string' },
            ai_phone_area_code: { type: 'string' },
            ai_receptionist_name: { type: 'string' },
            voice_gender: { type: 'string', nullable: true },
            ai_business_description: { type: 'string' },
            unknown_service_handling: { type: 'string' },
            unknown_service_call_fee: { type: 'number', nullable: true },
          },
        },
        BusinessProfileResponse: {
          type: 'object',
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            profile: { $ref: '#/components/schemas/BusinessProfile' },
          },
        },
        BusinessProfileUpdateInput: {
          type: 'object',
          required: ['business_id'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            profile: {
              type: 'object',
              additionalProperties: true,
              nullable: true,
            },
            name: { type: 'string' },
            industry: { type: 'string' },
            business_structure: { type: 'string' },
            company_email: { type: 'string' },
            company_phone: { type: 'string' },
            owner_phone: { type: 'string' },
            street: { type: 'string' },
            city: { type: 'string' },
            postal_code: { type: 'string' },
            country: { type: 'string' },
            logo_url: { type: 'string' },
            timezone: { type: 'string' },
            business_hours: {
              type: 'object',
              additionalProperties: true,
            },
            service_area_description: { type: 'string' },
            home_base_zip: { type: 'string' },
            service_radius_miles: { type: 'number' },
            cost_per_mile_over_radius: { type: 'number' },
            dedicated_phone_number: { type: 'string' },
            ai_phone_number: { type: 'string' },
            ai_phone_country: { type: 'string' },
            ai_phone_area_code: { type: 'string' },
            ai_receptionist_name: { type: 'string' },
            voice_gender: { type: 'string' },
            ai_business_description: { type: 'string' },
            unknown_service_handling: { type: 'string' },
            unknown_service_call_fee: { type: 'number' },
          },
        },
        BusinessAlertSettings: {
          type: 'object',
          properties: {
            missed_calls: { type: 'boolean' },
            inbound_sms: { type: 'boolean' },
            failed_checkins: { type: 'boolean' },
            overdue_invoices: { type: 'boolean' },
            expiring_quotes: { type: 'boolean' },
          },
        },
        BusinessAlertSettingsResponse: {
          type: 'object',
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            settings: { $ref: '#/components/schemas/BusinessAlertSettings' },
          },
        },
        BusinessAlertSettingsUpdateInput: {
          type: 'object',
          required: ['business_id'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            settings: { $ref: '#/components/schemas/BusinessAlertSettings' },
          },
        },
        BusinessAutomationSettings: {
          type: 'object',
          properties: {
            team_checkins_enabled: { type: 'boolean' },
            invoice_reminders_enabled: { type: 'boolean' },
            quote_follow_ups_enabled: { type: 'boolean' },
            default_check_in_frequency_hours: { type: 'number' },
            quote_expiry_days: { type: 'integer' },
            payment_follow_up_days: {
              type: 'array',
              items: { type: 'string' },
            },
            payment_interval: { type: 'string' },
          },
        },
        BusinessAutomationSettingsResponse: {
          type: 'object',
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            settings: { $ref: '#/components/schemas/BusinessAutomationSettings' },
          },
        },
        BusinessAutomationSettingsUpdateInput: {
          type: 'object',
          required: ['business_id'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            settings: { $ref: '#/components/schemas/BusinessAutomationSettings' },
            quote_expiry_days: { type: 'integer' },
            payment_follow_up_days: {
              type: 'array',
              items: { type: 'string' },
            },
            payment_interval: { type: 'string' },
          },
        },
        BusinessCommunicationSettings: {
          type: 'object',
          properties: {
            send_booking_confirmations: { type: 'boolean' },
            send_job_updates: { type: 'boolean' },
            send_invoice_reminders: { type: 'boolean' },
            missed_call_text_back: { type: 'boolean' },
            ai_receptionist_name: { type: 'string' },
            voice_gender: { type: 'string', nullable: true },
            ai_business_description: { type: 'string' },
            unknown_service_handling: { type: 'string' },
            unknown_service_call_fee: { type: 'number', nullable: true },
          },
        },
        BusinessCommunicationSettingsResponse: {
          type: 'object',
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            settings: { $ref: '#/components/schemas/BusinessCommunicationSettings' },
          },
        },
        BusinessCommunicationSettingsUpdateInput: {
          type: 'object',
          required: ['business_id'],
          properties: {
            business_id: { type: 'string', format: 'uuid' },
            settings: { $ref: '#/components/schemas/BusinessCommunicationSettings' },
            ai_receptionist_name: { type: 'string' },
            voice_gender: { type: 'string' },
            ai_business_description: { type: 'string' },
            unknown_service_handling: { type: 'string' },
            unknown_service_call_fee: { type: 'number' },
          },
        },
        ConversationCustomerSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            phone_number: { type: 'string' },
            email: { type: 'string' },
          },
        },
        ConversationListItem: {
          type: 'object',
          properties: {
            customer_id: { type: 'string', format: 'uuid' },
            customer: { $ref: '#/components/schemas/ConversationCustomerSummary' },
            latest_activity_title: { type: 'string' },
            latest_timestamp: { type: 'string', format: 'date-time' },
            dominant_channel: { type: 'string', enum: ['call', 'sms'] },
            total_events: { type: 'integer' },
          },
        },
        ConversationListResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/ConversationListItem' },
            },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
        ConversationEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            channel: { type: 'string', enum: ['call', 'sms'] },
            event_type: { type: 'string' },
            title: { type: 'string' },
            actor: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            error: { type: 'string', nullable: true },
            details: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        ConversationDetailResponse: {
          type: 'object',
          properties: {
            customer: { $ref: '#/components/schemas/ConversationCustomerSummary' },
            entries: {
              type: 'array',
              items: { $ref: '#/components/schemas/ConversationEntry' },
            },
          },
        },
        UserProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string', nullable: true },
            last_name: { type: 'string', nullable: true },
            auth_provider: { type: 'string', enum: ['Email', 'Google'] },
            onboarding_step: { type: 'integer' },
            onboarding_completed: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        TwilioAvailableNumber: {
          type: 'object',
          properties: {
            phone_number: { type: 'string' },
            friendly_name: { type: 'string' },
            locality: { type: 'string', nullable: true },
            region: { type: 'string', nullable: true },
            postal_code: { type: 'string', nullable: true },
            country: { type: 'string' },
            capabilities: {
              type: 'object',
              properties: {
                voice: { type: 'boolean' },
                sms: { type: 'boolean' },
                mms: { type: 'boolean' },
              },
            },
            type: { type: 'string' },
            area_code: { type: 'string', nullable: true },
          },
        },
        AvailableNumbersResponse: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['city', 'area_code', 'toll_free'] },
            country: { type: 'string' },
            count: { type: 'integer' },
            numbers: {
              type: 'array',
              items: { $ref: '#/components/schemas/TwilioAvailableNumber' },
            },
          },
        },
        WeeklyReportResponse: {
          type: 'object',
          additionalProperties: true,
          properties: {
            summary: { type: 'object', additionalProperties: true },
            report: { type: 'object', additionalProperties: true },
          },
        },
        SimpleMessageResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        JobAvailabilityResponse: {
          type: 'object',
          properties: {
            available: { type: 'boolean' },
            conflicts: {
              type: 'array',
              items: { $ref: '#/components/schemas/Job' },
            },
            staff_id: { type: 'string', format: 'uuid' },
            start_time: { type: 'string', format: 'date-time' },
            end_time: { type: 'string', format: 'date-time' },
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
      { name: 'Onboarding', description: 'Business setup, OTP verification, AI number provisioning, and onboarding completion' },
      { name: 'Customers', description: 'Customer management' },
      { name: 'Quotes', description: 'Quote lifecycle (EstimateScheduled → Approved → Job)' },
      { name: 'Jobs', description: 'Job management (Scheduled → Completed → Invoiced)' },
      { name: 'Billing', description: 'Invoices, payments, and expenses' },
      { name: 'Payments', description: 'Payment processing and payment recording' },
      { name: 'Expenses', description: 'Expense tracking endpoints' },
      { name: 'PriceBook', description: 'Service categories and price book' },
      { name: 'Inventory', description: 'Materials and inventory' },
      { name: 'Fleet', description: 'Vehicle and fleet management' },
      { name: 'Schedule', description: 'Schedule and calendar endpoints, including availability checks' },
      { name: 'Team', description: 'Staff directory, payroll, timesheets, and clock-in/out actions' },
      { name: 'Team Check-Ins', description: 'Field staff check-ins and escalation flows' },
      { name: 'Follow-Ups', description: 'Automated reminders and follow-up management' },
      { name: 'Dashboard', description: 'Analytics and reporting' },
      { name: 'Business Profile', description: 'Company profile, service area, and general business settings' },
      { name: 'Alerts', description: 'Alert preference settings for missed calls, invoices, and check-ins' },
      { name: 'Automation', description: 'Automation settings for reminders, expiries, and check-in defaults' },
      { name: 'Communication', description: 'Messaging defaults, AI receptionist settings, and communication behavior' },
      { name: 'Conversations', description: 'Customer call and SMS history' },
      { name: 'Bookkeeping', description: 'Transactions, summaries, categorization, and rules' },
      { name: 'AI Logs', description: 'AI event log inspection and manual event creation' },
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
