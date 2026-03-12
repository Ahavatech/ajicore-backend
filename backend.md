# Ajicore — Backend Development Plan

> A comprehensive backend platform for service businesses (plumbing, cleaning, electrical, maintenance, HVAC).
> Acts as a virtual office manager handling scheduling, invoicing, bookkeeping, inventory, and fleet tracking.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [API Endpoint Reference](#2-api-endpoint-reference)
3. [Domain Responsibilities](#3-domain-responsibilities)
4. [Integration Points](#4-integration-points)
5. [Cron Jobs & Automation](#5-cron-jobs--automation)
6. [Development Phases](#6-development-phases)
7. [Environment & Configuration](#7-environment--configuration)

---

## 1. Architecture Overview

```
├── prisma/                     # Database schema & migrations
│   └── schema.prisma
├── src/
│   ├── config/                 # Environment & constants
│   │   ├── env.js
│   │   └── constants.js
│   ├── api/
│   │   ├── routes/             # Express route definitions
│   │   │   ├── jobs.routes.js
│   │   │   ├── billing.routes.js
│   │   │   ├── inventory.routes.js
│   │   │   ├── fleet.routes.js
│   │   │   ├── staff.routes.js
│   │   │   └── ai_bridge.routes.js
│   │   └── middlewares/        # Auth, validation, error handling
│   │       ├── auth.middleware.js
│   │       ├── error.middleware.js
│   │       └── validate.middleware.js
│   ├── domains/                # Domain-Driven Design modules
│   │   ├── jobs/               # Job scheduling & management
│   │   ├── billing/            # Invoicing, payments, expenses
│   │   ├── inventory/          # Material tracking
│   │   ├── fleet/              # Vehicle management
│   │   ├── team/               # Staff & payroll
│   │   └── communications/     # SMS & notifications
│   ├── integrations/           # Third-party service wrappers
│   │   ├── payments/stripe_gateway.js
│   │   └── sms/twilio_gateway.js
│   ├── jobs/                   # Cron/scheduled tasks
│   │   ├── automated_reports.cron.js
│   │   ├── maintenance_reminders.cron.js
│   │   └── inventory_alerts.cron.js
│   ├── utils/                  # Shared utilities
│   │   ├── logger.js
│   │   └── report_generator.js
│   ├── app.js                  # Express app configuration
│   └── server.js               # Server entry point
├── .env.example
└── package.json
```

**Design Principles:**
- **Domain-Driven Design (DDD):** Each business domain is isolated with its own controller, service(s), and data access logic.
- **Separation of Concerns:** Routes handle HTTP, controllers handle request/response mapping, services contain business logic.
- **Lazy-loaded Integrations:** Stripe and Twilio are lazily initialized to prevent crashes when SDKs aren't installed.

---

## 2. API Endpoint Reference

### 2.1 Jobs Domain

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/jobs` | List jobs (filter: `business_id`, `status`, `page`, `limit`) | User |
| `GET` | `/api/jobs/schedule` | Get scheduled jobs (filter: `business_id`, `start_date`, `end_date`) | User |
| `GET` | `/api/jobs/:id` | Get job details with customer, staff, invoices, materials | User |
| `POST` | `/api/jobs` | Create a new job | User |
| `PATCH` | `/api/jobs/:id` | Update job (status, assignment, schedule) | User |
| `DELETE` | `/api/jobs/:id` | Delete a job | User |

### 2.2 Billing Domain

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/billing/invoices/job/:jobId` | Get all quotes/invoices for a job | User |
| `POST` | `/api/billing/invoices` | Create a quote or invoice | User |
| `PATCH` | `/api/billing/invoices/:id` | Update invoice status, amounts, notes | User |
| `POST` | `/api/billing/payments/:invoiceId` | Process payment (Stripe) | User |
| `GET` | `/api/billing/expenses` | List expenses (filter: `business_id`, `category`, date range) | User |
| `POST` | `/api/billing/expenses` | Create a new expense record | User |

### 2.3 Inventory Domain

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/inventory` | List materials (filter: `business_id`, `low_stock`) | User |
| `GET` | `/api/inventory/:id` | Get material details | User |
| `POST` | `/api/inventory` | Create a new material | User |
| `PATCH` | `/api/inventory/:id` | Update material (stock, threshold, cost) | User |
| `POST` | `/api/inventory/deduct/:jobId` | Deduct materials for a completed job | User |

### 2.4 Fleet Domain

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/fleet` | List vehicles (filter: `business_id`) | User |
| `GET` | `/api/fleet/maintenance-alerts` | Get vehicles needing maintenance/renewals | User |
| `GET` | `/api/fleet/:id` | Get vehicle details | User |
| `POST` | `/api/fleet` | Create a new vehicle | User |
| `PATCH` | `/api/fleet/:id` | Update vehicle details | User |
| `PATCH` | `/api/fleet/:id/mileage` | Update mileage (triggers maintenance check) | User |

### 2.5 Staff & Payroll Domain

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/staff` | List staff members (filter: `business_id`) | User |
| `GET` | `/api/staff/payroll` | Calculate payroll (filter: `business_id`, `start_date`, `end_date`) | User |
| `GET` | `/api/staff/:id` | Get staff details with recent timesheets | User |
| `POST` | `/api/staff` | Create a new staff member | User |
| `PATCH` | `/api/staff/:id` | Update staff member | User |
| `POST` | `/api/staff/:id/clock-in` | Clock in (creates timesheet entry) | User |
| `POST` | `/api/staff/:id/clock-out` | Clock out (calculates total hours) | User |

### 2.6 AI Bridge (Internal API)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/internal/schedule` | AI queries upcoming schedule | API Key |
| `GET` | `/api/internal/jobs` | AI queries jobs | API Key |
| `POST` | `/api/internal/jobs` | AI creates a new job | API Key |
| `PATCH` | `/api/internal/jobs/:id` | AI updates a job | API Key |
| `GET` | `/api/internal/inventory` | AI queries material levels | API Key |
| `POST` | `/api/internal/sms/incoming` | Twilio webhook for incoming SMS | API Key |
| `POST` | `/api/internal/sms/send` | AI sends an outbound SMS | API Key |

### 2.7 System

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/health` | Health check | None |

---

## 3. Domain Responsibilities

### 3.1 Jobs Domain (`src/domains/jobs/`)
- **job.service.js**: CRUD operations for jobs with pagination, filtering, and relation loading.
- **schedule.service.js**: Schedule queries, staff availability checks, and conflict detection.
- **Key Business Logic**:
  - Status transitions: `Pending → Scheduled → InProgress → Completed/Cancelled`
  - When a job is marked `Completed`, trigger material deduction (via inventory domain).
  - Validate staff availability before scheduling.

### 3.2 Billing Domain (`src/domains/billing/`)
- **invoice.service.js**: Quote/invoice lifecycle (Draft → Sent → Paid).
- **payment.service.js**: Stripe payment processing with partial payment support.
- **expense.service.js**: Expense tracking and categorization.
- **Key Business Logic**:
  - Quotes can be converted to invoices.
  - Invoices support partial payments — status auto-updates to `PartiallyPaid` or `Paid`.
  - Expenses can optionally link to specific jobs for per-job cost tracking.

### 3.3 Inventory Domain (`src/domains/inventory/`)
- **material.service.js**: Material CRUD, stock tracking, and auto-deduction.
- **Key Business Logic**:
  - When materials are deducted for a job, `Job_Material` records are created for audit trail.
  - Low-stock alerts trigger when `quantity_on_hand <= restock_threshold`.

### 3.4 Fleet Domain (`src/domains/fleet/`)
- **fleet.service.js**: Vehicle CRUD, mileage tracking, and maintenance alerts.
- **Key Business Logic**:
  - Mileage updates trigger maintenance checks: `(current_mileage - last_maintenance_mileage) >= maintenance_cycle_miles`.
  - Insurance and registration expiry alerts within 30-day window.

### 3.5 Team Domain (`src/domains/team/`)
- **staff.controller.js**: Staff CRUD and timesheet clock-in/clock-out.
- **payroll.service.js**: Payroll calculation based on timesheets × hourly rates.
- **Key Business Logic**:
  - Clock-out automatically calculates `total_hours`.
  - Payroll aggregates all timesheet entries within a date range per staff member.

### 3.6 Communications Domain (`src/domains/communications/`)
- **sms.controller.js**: Twilio webhook handler and outbound SMS.
- **notification.service.js**: SMS sending and AI service routing.
- **Key Business Logic**:
  - Incoming SMS → forwarded to AI service → AI response sent back via TwiML.
  - Outbound SMS for reports, alerts, and customer notifications.

---

## 4. Integration Points

### 4.1 Stripe (`src/integrations/payments/stripe_gateway.js`)
- **PaymentIntent creation** for invoice payments.
- **Webhook handling** for payment confirmations and failures.
- **Setup Required**: Install `stripe` package, set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.

### 4.2 Twilio (`src/integrations/sms/twilio_gateway.js`)
- **Outbound SMS** for notifications, reports, and alerts.
- **Inbound SMS webhook** for AI-powered command routing.
- **Setup Required**: Install `twilio` package, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

### 4.3 AI Service (External)
- Ajicore exposes internal APIs (`/api/internal/*`) for the AI service to consume.
- AI service processes natural language SMS commands and returns structured responses.
- Communication is authenticated via `x-api-key` header.

---

## 5. Cron Jobs & Automation

| Job | Schedule | File | Description |
|-----|----------|------|-------------|
| Weekly Reports | Mon 8:00 AM | `automated_reports.cron.js` | Compiles revenue, expenses, job counts and sends SMS summary to business owners |
| Maintenance Reminders | Daily 7:00 AM | `maintenance_reminders.cron.js` | Checks fleet for overdue maintenance, expiring insurance/registration |
| Inventory Alerts | Daily 9:00 AM | `inventory_alerts.cron.js` | Identifies low-stock materials and sends restock notifications |

**Integration**: Use `node-cron` package to schedule these in the server entry point, or deploy as separate worker processes.

---

## 6. Development Phases

### Phase 1: Foundation ✅ (Current)
- [x] Project scaffolding with DDD architecture
- [x] Prisma schema with all models and relations
- [x] Express boilerplate with middleware stack
- [x] All route, controller, and service files created
- [x] Integration gateway stubs (Stripe, Twilio)
- [x] Cron job templates

### Phase 2: Core CRUD & Database
- [ ] Run `prisma migrate dev` against the shared PostgreSQL database
- [ ] Test all CRUD endpoints for Customers, Jobs, Staff, Materials, Vehicles
- [ ] Add customer CRUD routes (currently handled through jobs — need dedicated routes)
- [ ] Implement proper pagination across all list endpoints
- [ ] Add sorting and advanced filtering

### Phase 3: Business Logic
- [ ] Job status transition validation (prevent invalid transitions)
- [ ] Auto-deduct materials when job status changes to `Completed`
- [ ] Quote-to-invoice conversion endpoint
- [ ] Staff availability conflict detection on job scheduling
- [ ] Payroll calculation with overtime rules

### Phase 4: Integrations
- [ ] Install and configure Stripe SDK
- [ ] Implement full payment flow with webhook handling
- [ ] Install and configure Twilio SDK
- [ ] Set up Twilio webhook URL for incoming SMS
- [ ] Test AI Bridge endpoints with the AI service

### Phase 5: Automation & Cron
- [ ] Install `node-cron` and wire up scheduled tasks
- [ ] Test weekly report generation and SMS delivery
- [ ] Test maintenance reminder alerts
- [ ] Test inventory low-stock alerts

### Phase 6: Security & Production
- [ ] Implement JWT authentication (replace placeholder `requireAuth`)
- [ ] Add rate limiting middleware
- [ ] Input sanitization and SQL injection prevention (Prisma handles most)
- [ ] Request logging with correlation IDs
- [ ] Health check expansion (DB connectivity, integration status)
- [ ] Error monitoring integration (Sentry, etc.)
- [ ] API documentation (Swagger/OpenAPI)

---

## 7. Environment & Configuration

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `DATABASE_URL` | PostgreSQL connection string | **Yes** |
| `STRIPE_SECRET_KEY` | Stripe API secret key | Phase 4 |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Phase 4 |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | Phase 4 |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | Phase 4 |
| `TWILIO_PHONE_NUMBER` | Twilio phone number (E.164) | Phase 4 |
| `AI_SERVICE_URL` | AI service base URL | Phase 4 |
| `AI_SERVICE_API_KEY` | AI service authentication key | Phase 4 |
| `INTERNAL_API_KEY` | Key for AI Bridge authentication | Phase 4 |

### Getting Started

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Update DATABASE_URL in .env with your PostgreSQL credentials

# 3. Install dependencies
npm install

# 4. Generate Prisma client
npx prisma generate

# 5. Run database migrations
npx prisma migrate dev --name init

# 6. Start development server
npm run dev
```