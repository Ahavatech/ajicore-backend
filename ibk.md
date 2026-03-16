# Ajicore v2.0

AI-powered back-office platform for blue-collar service businesses (plumbing, HVAC, electrical, maintenance). Serves as a virtual office manager — automating scheduling, quoting, invoicing, inventory, fleet, and payroll. Dual API: JWT for frontend, API-key for AI call-center service.

## Architecture

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: JWT + bcryptjs (frontend) / x-api-key header (AI service)
- **Dev Server**: nodemon
- **Docs**: Swagger UI at `/api/docs` + raw JSON at `/api/docs.json`
- **Postman**: `ajicore_postman_collection.json` (93 requests)

## Project Structure

```
prisma/
  schema.prisma            # Full schema (all models + enums)
  migrations/              # Applied migrations
src/
  app.js                   # Express app: all routes, Swagger, error handling
  server.js                # Entry point
  config/
    swagger.js             # OpenAPI 3.0 spec configuration
    env.js                 # Environment variable loader
    constants.js           # Enums, cron schedules, status arrays
  api/
    routes/
      auth.routes.js       # POST /signup /signin /me /onboarding
      customers.routes.js  # /api/customers
      jobs.routes.js       # /api/jobs (+ /start /complete /materials /photos)
      quotes.routes.js     # /api/quotes (+ /send /approve /decline)
      billing.routes.js    # /api/billing/invoices /payments /expenses
      pricebook.routes.js  # /api/price-book (+ /categories)
      dashboard.routes.js  # /api/dashboard/summary /weekly-report /revenue
      inventory.routes.js  # /api/inventory (+ /restock)
      fleet.routes.js      # /api/fleet (+ /mileage /maintenance-alerts)
      staff.routes.js      # /api/staff (+ /clock-in /clock-out /timesheets)
      ai_bridge.routes.js  # /api/internal/ai/* + /sms/* + schedule/jobs/quotes
    middlewares/
      auth.middleware.js   # requireAuth (JWT), requireInternalApiKey
      validate.middleware.js
      error.middleware.js
  domains/
    auth/                  # User auth, onboarding
    customers/             # Customer CRUD, phone lookup, history
    quotes/                # Quote lifecycle (EstimateScheduled→Approved→Job)
    jobs/                  # Job lifecycle (Scheduled→Completed→Invoiced)
    billing/
      invoice.service.js   # Full invoice CRUD with line items, audit log, refund/void
      payment.service.js   # Payment recording (Stripe optional)
      expense.service.js   # Expense tracking
    pricebook/             # Service categories + price book items
    dashboard/             # KPI summary, revenue chart, jobs analytics
    communications/        # SMS controller, notification service, AI routing
    fleet/                 # Vehicle CRUD, mileage, maintenance alerts
    inventory/             # Material CRUD, restock, low-stock detection
    team/                  # Staff CRUD, clock-in/out, timesheets, payroll
  integrations/
    payments/stripe_gateway.js  # Stripe (optional, isConfigured() check)
    sms/twilio_gateway.js       # Twilio SMS
  jobs/
    automated_reports.cron.js   # Weekly report → SMS to owner
    inventory_alerts.cron.js    # Daily low-stock alerts
    maintenance_reminders.cron.js # Fleet alerts + quote expiry
  utils/
    logger.js
    report_generator.js    # generateWeeklyReport, generateDashboardSummary
```

## Key Business Flows

### Quote Path (Price Unknown / Needs On-Site)
`POST /api/quotes` (EstimateScheduled) → visit site → `PATCH` (add pricing, Draft) → `POST .../send` (Sent) → `POST .../approve` → **Job created** (Scheduled)

### Job Path (Price Known)
`POST /api/jobs` (Scheduled) → `POST .../start` (InProgress) → `POST .../complete` (Completed) → `POST /api/billing/invoices` → `POST /api/billing/payments/:id`

### AI Call Flow
1. `GET /api/internal/ai/business-config` — load receptionist context
2. `GET /api/internal/customers/lookup?phone=...` — identify caller
3. `GET /api/internal/ai/price-lookup?service=...` — check pricing
4. `POST /api/internal/ai/radius-check` — validate service area
5. `POST /api/internal/ai/book` — create Quote or Job

### Invoice Edit Rules
| Status | Edit Rules |
|--------|-----------|
| Draft / Sent | Full edit (line items, notes, due date) |
| Paid | internal_notes only |
| Refunded / Voided | Locked |

All edits on paid+ invoices are recorded in `invoice_edit_logs`.

## API Domains (93 total endpoints)

| Domain | Auth | Base Path |
|--------|------|-----------|
| Auth | Public / JWT | `/api/auth` |
| Customers | JWT | `/api/customers` |
| Quotes | JWT | `/api/quotes` |
| Jobs | JWT | `/api/jobs` |
| Billing | JWT | `/api/billing` |
| Price Book | JWT | `/api/price-book` |
| Inventory | JWT | `/api/inventory` |
| Fleet | JWT | `/api/fleet` |
| Staff | JWT | `/api/staff` |
| Dashboard | JWT | `/api/dashboard` |
| AI Bridge | x-api-key | `/api/internal` |

## Documentation

- **Swagger UI**: `GET /api/docs`
- **OpenAPI JSON** (Postman import): `GET /api/docs.json`
- **Postman Collection**: `ajicore_postman_collection.json` in project root

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL (auto-set by Replit) |
| `DIRECT_URL` | Yes | Same as DATABASE_URL |
| `PORT` | No | Default 3000 |
| `NODE_ENV` | No | development/production |
| `JWT_SECRET` | Yes | JWT signing key |
| `JWT_EXPIRES_IN` | No | Default 7d |
| `INTERNAL_API_KEY` | Yes | AI service auth key |
| `STRIPE_SECRET_KEY` | No | Optional Stripe |
| `STRIPE_WEBHOOK_SECRET` | No | Optional Stripe |
| `TWILIO_ACCOUNT_SID` | No | Optional SMS |
| `TWILIO_AUTH_TOKEN` | No | Optional SMS |
| `TWILIO_PHONE_NUMBER` | No | Optional SMS |

## Workflow

- **Start application**: `npm run dev` → port 3000
- **Deployment**: autoscale, `node src/server.js`

## Cron Jobs (manual registration required)

```js
const cron = require('node-cron');
cron.schedule('0 8 * * 1', () => require('./src/jobs/automated_reports.cron').runWeeklyReports());
cron.schedule('0 9 * * *', () => require('./src/jobs/inventory_alerts.cron').runInventoryAlerts());
cron.schedule('0 7 * * *', () => require('./src/jobs/maintenance_reminders.cron').runMaintenanceReminders());
cron.schedule('0 0 * * *', () => require('./src/jobs/maintenance_reminders.cron').runQuoteExpiry());
```
