# Ajicore

A comprehensive backend platform for service businesses — scheduling, invoicing, bookkeeping, inventory, fleet tracking, and AI-powered automation.

## Architecture

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: PostgreSQL (Replit built-in) via Prisma ORM
- **Auth**: JWT + Bcrypt; Google OAuth supported
- **API Docs**: Swagger UI at `/api/docs`

## Project Structure

```
src/
  app.js              - Express setup (middleware, routes, error handling)
  server.js           - Server entry point (port 5000, 0.0.0.0)
  config/
    env.js            - Environment variable loader & validation
    swagger.js        - Swagger/OpenAPI config
  api/
    routes/           - Express route definitions
    middlewares/       - Auth (requireAuth), rate limiting, validation, error handling
  domains/            - Business logic by feature (thin controllers, logic in services)
    auth/             - Registration, login, onboarding (5 steps)
    billing/          - Invoices, payments, expenses
    jobs/             - Service jobs management
    quotes/           - Quote/estimate management
    fleet/            - Vehicle tracking
    inventory/        - Materials & stock
    pricebook/        - Price book items
    team/             - Staff management & payroll
    customers/        - Customer CRUD + computed `name` field in all responses
    dashboard/        - Analytics & reporting
    communications/   - SMS/notification service
    follow_ups/       - Automated follow-up management (quotes, invoices)
    team_checkins/    - Staff check-in scheduling and escalation
    bookkeeping/      - Bank transactions + AI categorization rules
    ai_logs/          - AI event audit log
  integrations/
    payments/         - Stripe gateway
    sms/              - Twilio gateway
  jobs/               - Background cron tasks
  utils/              - Logger, error helpers, report generation
prisma/
  schema.prisma       - Database schema (v2)
  migrations/         - Migration history
```

## API Routes

| Path | Description |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/docs` | Swagger UI |
| `/api/auth` | Auth & onboarding |
| `/api/customers` | Customer management |
| `/api/jobs` | Job lifecycle |
| `/api/quotes` | Quote/estimate flow |
| `/api/billing` | Invoices, payments, expenses |
| `/api/inventory` | Materials & stock |
| `/api/fleet` | Vehicle fleet |
| `/api/staff` | Staff & payroll |
| `/api/price-book` | Price book items |
| `/api/dashboard` | Analytics |
| `/api/internal` | AI Bridge (API key protected) |
| `/api/follow-ups` | Automated follow-ups |
| `/api/team-checkins` | Staff check-ins & escalation |
| `/api/bookkeeping` | Bank transactions & categorization rules |
| `/api/ai-logs` | AI event audit logs |

## Schema (v2 — AI Alignment)

### Updated Models
- **Business**: + `timezone`, `business_hours` (Json), `ai_receptionist_name`, `voice_gender`, `service_area_description`, `owner_phone`
- **Job**: + `address`, `service_type`, `created_by`
- **Quote**: + `follow_up_count`, `auto_reminders_paused`
- **Invoice**: + `follow_up_count`, `auto_reminders_paused`, `last_follow_up`, `customer_responded`
- **PriceBookItem**: + `recognition_tags` (Json), `estimated_duration_hours`
- **Staff**: + `check_in_frequency_hours`, `active_job_id` (relation)
- **Vehicle**: + `name`
- **Customer**: computed `name` field (`first_name + last_name`) added to all API responses at service layer

### New Models
- **FollowUp** (`follow_ups`): Scheduled follow-ups with channel, status, tone, attempt tracking
- **TeamCheckin** (`team_checkins`): Staff check-in scheduling with escalation support
- **BankTransaction** (`bank_transactions`): Imported financial transactions with AI categorization
- **CategorizationRule** (`categorization_rules`): Vendor pattern → category auto-matching rules
- **AiEventLog** (`ai_event_logs`): Full audit trail of all AI-driven actions

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection (set by Replit)
- `NODE_ENV` - Runtime environment (`development`)
- `PORT` - Server port (5000)
- `JWT_SECRET` - Token signing secret
- `INTERNAL_API_KEY` - AI bridge protection key
- `ALLOWED_ORIGINS` - CORS allowed origins

Optional integrations:
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `AI_SERVICE_URL`, `AI_SERVICE_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Running

- **Dev**: `npm run dev` (nodemon, port 5000, 0.0.0.0)
- **Production**: `node src/server.js`
- **DB migrations**: `npx prisma migrate deploy`

## Notes

- `directUrl` removed from `prisma/schema.prisma` — it was for Supabase; Replit's built-in DB doesn't need it.
- Server listens on `0.0.0.0` for Replit's proxy to work correctly.
- All business logic lives in service files; controllers are thin HTTP handlers only.
- `business_id` flows from query params (GET) or request body (POST/PATCH) — consistent with existing pattern.
