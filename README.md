# Ajicore Backend

A comprehensive backend platform for **service businesses** — scheduling, quoting, invoicing, bookkeeping, inventory, fleet tracking, team management, and an internal AI-agent bridge — built with **Node.js, Express, Prisma, and PostgreSQL**.

- **Runtime:** Node.js ≥ 18 (Docker image uses Node 20)
- **Package manager:** pnpm 10.15.0
- **Database:** PostgreSQL via Prisma ORM (31 models)
- **Entry point:** [src/server.js](src/server.js) → [src/app.js](src/app.js)

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Map](#architecture-map)
3. [Request Lifecycle](#request-lifecycle)
4. [Directory Structure](#directory-structure)
5. [API Surface](#api-surface)
6. [Domains](#domains)
7. [Authentication & Security](#authentication--security)
8. [Data Model](#data-model)
9. [External Integrations](#external-integrations)
10. [Environment Variables](#environment-variables)
11. [Scripts & Tooling](#scripts--tooling)
12. [Testing](#testing)
13. [Docker & Deployment](#docker--deployment)
14. [API Documentation](#api-documentation)

---

## Quick Start

```bash
# 1. Install dependencies (runs `prisma generate` automatically via postinstall)
pnpm install

# 2. Create a .env file with at minimum:
#    JWT_SECRET, DATABASE_URL, NODE_ENV
cp .env.example .env   # or create manually — see "Environment Variables" below

# 3. Apply database migrations
pnpm prisma:migrate          # dev (interactive)
# or
pnpm prisma:migrate:deploy   # non-interactive / CI / prod

# 4. Run
pnpm dev      # nodemon, auto-reload
pnpm start    # production (runs `prisma migrate deploy` first via prestart)

# 5. Verify
curl http://localhost:3000/api/health
```

Interactive API docs are then available at `http://localhost:3000/api/docs` (Swagger UI) and `http://localhost:3000/api/reference` (Scalar).

---

## Architecture Map

The codebase follows a **layered, domain-driven structure**: thin route files wire HTTP endpoints to controllers, controllers validate/shape requests, and services hold the business logic and talk to Prisma.

```
                                ┌─────────────────────────────┐
    Clients                     │        External world        │
  (frontend, mobile,            │  Stripe · Twilio · SMTP ·    │
   Postman, AI service)         │  GCS/Cloudinary · AI service │
        │                       └──────────────┬──────────────┘
        ▼                                      │ webhooks / API calls
┌──────────────────────────────────────────────┼──────────────────────┐
│ src/server.js  — boots Express on PORT       │                      │
│ src/app.js     — the wiring hub              ▼                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ GLOBAL MIDDLEWARE (in order)                               │    │
│  │  helmet (CSP/HSTS) → CORS → HTTPS redirect (prod)          │    │
│  │  → /api/webhooks (RAW body, before JSON parser!)           │    │
│  │  → express.json (1mb) → request logging → rate limiters    │    │
│  └───────────────┬────────────────────────────────────────────┘    │
│                  ▼                                                  │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ ROUTES  src/api/routes/*.routes.js                         │    │
│  │  /api/auth /api/customers /api/jobs /api/quotes            │    │
│  │  /api/billing /api/inventory /api/fleet /api/staff         │    │
│  │  /api/dashboard /api/bookkeeping /api/reports ...          │    │
│  │  /api/internal  ← AI Bridge (X-API-Key, not JWT)           │    │
│  └───────────────┬────────────────────────────────────────────┘    │
│                  │  route-level middleware:                        │
│                  │  auth.middleware (JWT / internal key)           │
│                  │  validate.middleware (required fields)          │
│                  ▼                                                  │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ CONTROLLERS  src/domains/<domain>/<name>.controller.js     │    │
│  │  parse request → call service → shape response             │    │
│  └───────────────┬────────────────────────────────────────────┘    │
│                  ▼                                                  │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ SERVICES  src/domains/<domain>/<name>.service.js           │    │
│  │  business logic, cross-domain calls, external gateways     │    │
│  └───────┬───────────────────────┬────────────────────────────┘    │
│          ▼                       ▼                                  │
│  ┌───────────────┐   ┌─────────────────────────────────────┐       │
│  │ src/lib/      │   │ src/integrations/                   │       │
│  │ prisma.js     │   │  payments/stripe_gateway.js         │       │
│  │ (singleton    │   │  sms/twilio_gateway.js              │       │
│  │  PrismaClient)│   │  twilio/twilio_client.js            │       │
│  └───────┬───────┘   └─────────────────────────────────────┘       │
│          ▼                                                          │
│  ┌───────────────┐   ┌─────────────────────────────────────┐       │
│  │  PostgreSQL   │   │ src/jobs/ (cron)                    │       │
│  │  (Prisma,     │   │  automated_reports.cron.js          │       │
│  │  31 models)   │   │  inventory_alerts.cron.js           │       │
│  └───────────────┘   │  maintenance_reminders.cron.js      │       │
│                      └─────────────────────────────────────┘       │
│  errors bubble up → error.middleware (notFoundHandler,             │
│  errorHandler) using typed errors from src/utils/errors.js         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Request Lifecycle

Every request through [src/app.js](src/app.js) passes, in order:

1. **`trust proxy`** — respects `X-Forwarded-*` headers from Dokploy/ingress ([app.js:57](src/app.js#L57)).
2. **Helmet** — CSP, HSTS (1 year), frame-deny, nosniff, strict referrer ([app.js:72-98](src/app.js#L72-L98)).
3. **CORS** — allows no-origin clients (mobile/curl), auto-allows localhost in dev, checks `ALLOWED_ORIGINS`; never hard-blocks (lets the browser enforce) ([app.js:101-139](src/app.js#L101-L139)).
4. **HTTPS enforcement (production)** — redirects `http→https` via `x-forwarded-proto`, but never redirects `OPTIONS` preflights and exempts local `/api/health` probes ([app.js:142-172](src/app.js#L142-L172)).
5. **Stripe webhooks mounted early** — `/api/webhooks` is mounted **before** `express.json()` because Stripe signature verification needs the raw body ([app.js:175](src/app.js#L175)).
6. **Body parsing** — JSON & urlencoded, 1 MB limit, `parameterLimit: 50`.
7. **Request logging** — logs method/path/status/duration via [src/utils/logger.js](src/utils/logger.js).
8. **Rate limiting** ([rate_limit.middleware.js](src/api/middlewares/rate_limit.middleware.js)) — `docs` (lenient) for documentation routes, `auth` (strict) for `/api/auth`, `standard` for everything else under `/api`. `/api/health` is exempt.
9. **Route handler** → per-route auth/validation middleware → controller → service → Prisma.
10. **Error handling** — `notFoundHandler` (404) then `errorHandler`, which maps typed errors from [src/utils/errors.js](src/utils/errors.js) to HTTP responses.

---

## Directory Structure

```
ajicore-backend/
├── src/
│   ├── server.js               # Entry point — starts Express on PORT
│   ├── app.js                  # App wiring: middleware, routes, docs, errors
│   ├── config/
│   │   ├── env.js              # Env loading + startup validation (fails fast)
│   │   ├── constants.js        # Shared constants
│   │   ├── openapi.js          # OpenAPI spec builder + Scalar renderer
│   │   └── swagger.js          # swagger-jsdoc configuration
│   ├── api/
│   │   ├── routes/             # One *.routes.js per resource; docs/ has swagger JSDoc
│   │   └── middlewares/
│   │       ├── auth.middleware.js       # JWT auth + internal API key auth
│   │       ├── validate.middleware.js   # requireFields & friends
│   │       ├── rate_limit.middleware.js # docs / auth / standard limiters
│   │       └── error.middleware.js      # notFoundHandler + errorHandler
│   ├── domains/                # Business logic, one folder per domain
│   │   └── <domain>/           #   *.controller.js (HTTP) + *.service.js (logic)
│   ├── integrations/           # External-service gateways (Stripe, Twilio)
│   ├── jobs/                   # Cron jobs (reports, inventory alerts, maintenance)
│   ├── lib/prisma.js           # Singleton PrismaClient
│   └── utils/                  # errors, logger, financial calc, report generator
├── prisma/
│   ├── schema.prisma           # 31 models, 22 enums (PostgreSQL)
│   └── migrations/             # Migration history (applied via migrate deploy)
├── scripts/                    # Ops helpers (AI API export, Twilio audit, PDF handoff)
├── test/                       # Jest tests (test/jest/*.spec.js + integration tests)
├── docs/                       # Exported API JSON, Postman collection, page map
├── uploads/                    # Local file uploads (served at /uploads)
├── logs/                       # Application logs
├── Dockerfile                  # Production image (node:20-bookworm-slim)
└── ajicore_postman_collection.json
```

---

## API Surface

All routes are prefixed with `/api`. Mounted in [src/app.js](src/app.js#L257-L283):

| Mount | Route file | Purpose |
|---|---|---|
| `/api/health` | (inline) | Liveness check, no auth, no rate limit |
| `/api/auth` | [auth.routes.js](src/api/routes/auth.routes.js) | Signup, login, OTP, password reset (email/SMS), onboarding |
| `/api/users` | [users.routes.js](src/api/routes/users.routes.js) | User profile management |
| `/api/business`, `/api/businesses` | business*.routes.js | Business settings & multi-business management |
| `/api/customers` | [customers.routes.js](src/api/routes/customers.routes.js) | Customer CRM |
| `/api/jobs` | [jobs.routes.js](src/api/routes/jobs.routes.js) | Job creation, scheduling, status flow |
| `/api/quotes` | [quotes.routes.js](src/api/routes/quotes.routes.js) | Quote lifecycle |
| `/api/billing` | [billing.routes.js](src/api/routes/billing.routes.js) | Invoices, payments, expenses, PDF generation |
| `/api/bookkeeping` | [bookkeeping.routes.js](src/api/routes/bookkeeping.routes.js) | Bank transactions, categorization rules, receipt OCR, ledger |
| `/api/inventory` | [inventory.routes.js](src/api/routes/inventory.routes.js) | Materials & job-material usage |
| `/api/price-book` | [pricebook.routes.js](src/api/routes/pricebook.routes.js) | Service categories & price book items |
| `/api/fleet` | [fleet.routes.js](src/api/routes/fleet.routes.js) | Vehicles & fleet repairs |
| `/api/staff`, `/api/team` | [staff.routes.js](src/api/routes/staff.routes.js) | Staff, timesheets, payroll (two aliases, same router) |
| `/api/team-checkins` | [team_checkins.routes.js](src/api/routes/team_checkins.routes.js) | Field team check-ins |
| `/api/follow-ups` | [follow_ups.routes.js](src/api/routes/follow_ups.routes.js) | Customer follow-up scheduling |
| `/api/conversations` | [conversations.routes.js](src/api/routes/conversations.routes.js) | AI/customer conversation threads & messages |
| `/api/notifications` | [notifications.routes.js](src/api/routes/notifications.routes.js) | In-app notifications |
| `/api/dashboard` | [dashboard.routes.js](src/api/routes/dashboard.routes.js) | Aggregated KPIs |
| `/api/reports` | [reports.routes.js](src/api/routes/reports.routes.js) | Business reports |
| `/api/search` | [search.routes.js](src/api/routes/search.routes.js) | Cross-entity search |
| `/api/upload` | [upload.routes.js](src/api/routes/upload.routes.js) | File uploads (local / GCS / Cloudinary) |
| `/api/integrations` | [integrations.routes.js](src/api/routes/integrations.routes.js) | Third-party integration management |
| `/api/subscriptions` | [subscriptions.routes.js](src/api/routes/subscriptions.routes.js) | Stripe-backed business subscriptions & trials |
| `/api/ai` | [ai.routes.js](src/api/routes/ai.routes.js) | AI chat endpoints |
| `/api/ai-logs` | [ai_logs.routes.js](src/api/routes/ai_logs.routes.js) | AI event & activity logs |
| `/api/internal` | [ai_bridge.routes.js](src/api/routes/ai_bridge.routes.js) | **AI Bridge** — internal API for the AI service (see below) |
| `/api/webhooks` | [webhooks.routes.js](src/api/routes/webhooks.routes.js) | Stripe webhooks (raw body) |
| `/api/docs`, `/api/docs.json`, `/api/reference` | (inline) | Swagger UI, raw OpenAPI JSON, Scalar reference |
| `/uploads` | static | Locally stored uploaded files |

---

## Domains

Each folder in [src/domains/](src/domains/) pairs a controller (HTTP layer) with one or more services (business logic):

- **auth** — signup/login, JWT issuance, OTP, multi-channel password reset, onboarding (including trial subscription creation).
- **users / business** — profiles and business configuration (finance settings, voice settings, service handling).
- **customers** — CRM records tied to a business.
- **jobs** — jobs plus [schedule.service.js](src/domains/jobs/schedule.service.js) for scheduling logic; job types, visit types, statuses.
- **quotes** — quote drafting and status transitions (linked to jobs/customers).
- **billing** — invoices with line items and edit logs, payments (Stripe), expenses, and PDF invoices via [invoice_pdf.service.js](src/domains/billing/invoice_pdf.service.js) (pdfkit).
- **bookkeeping** — bank transactions, auto-categorization rules, receipt OCR intake, and a ledger service.
- **inventory / pricebook** — materials, per-job material usage, service categories and priced items.
- **fleet** — vehicles and repair tracking, with maintenance-reminder cron support.
- **team / team_checkins** — staff, roles, timesheets, payroll records, and field check-ins.
- **follow_ups** — scheduled customer follow-ups by channel (SMS/email/call).
- **communications** — [email.service.js](src/domains/communications/email.service.js) (nodemailer/SMTP), [sms.controller.js](src/domains/communications/sms.controller.js) and [call.controller.js](src/domains/communications/call.controller.js) (Twilio), plus notification dispatch.
- **conversations** — conversation threads and messages across channels (used by the AI service).
- **ai / ai_logs** — AI chat controller/service and structured AI event + activity logging.
- **subscriptions / webhooks** — Stripe subscription lifecycle and webhook ingestion ([stripe_webhook.controller.js](src/domains/webhooks/stripe_webhook.controller.js)).
- **dashboard / reports / search / notifications / upload / integrations** — aggregation, reporting, search, notification, file-storage, and integration management layers.

### The AI Bridge (`/api/internal`)

A separate **AI service** (hosted at `api.myajicore.com`) handles inbound Twilio calls/SMS directly — this backend never receives them. Instead, the AI service calls back into this backend through [ai_bridge.routes.js](src/api/routes/ai_bridge.routes.js), authenticated with the `INTERNAL_API_KEY` (`X-API-Key` header) rather than a user JWT, plus business-scoped access checks (`requireInternalBusinessAccess` / `requireInternalResourceAccess`). It exposes jobs, quotes, customers, inventory, staff, billing, follow-ups, check-ins, price book, and SMS/call actions to the AI agent.

### Cron Jobs

[src/jobs/](src/jobs/) contains three scheduled tasks: automated report generation, low-inventory alerts, and vehicle maintenance reminders.

---

## Authentication & Security

- **User auth:** JWT (`jsonwebtoken`), bcryptjs password hashing, configurable expiry (`JWT_EXPIRES_IN`). Google OAuth supported (`AuthProvider` enum, `GOOGLE_CLIENT_ID/SECRET`).
- **Internal auth:** static `INTERNAL_API_KEY` for the AI bridge, checked in [auth.middleware.js](src/api/middlewares/auth.middleware.js).
- **Transport & headers:** Helmet CSP/HSTS, production HTTPS redirect, `trust proxy` for reverse-proxy deployments.
- **Abuse protection:** tiered rate limiting (strict on `/api/auth`), 1 MB body limit, `parameterLimit: 50` against parameter pollution.
- **Fail-fast config:** [src/config/env.js](src/config/env.js) throws at boot if required variables are missing — and in production additionally requires Stripe, Twilio, and SMTP configuration (it even rejects placeholder Twilio phone numbers).

---

## Data Model

Defined in [prisma/schema.prisma](prisma/schema.prisma) (PostgreSQL, 31 models, 22 enums). The core entity graph:

```
User ──< Business ──┬──< Customer ──┬──< Quote ──── Job
                    │               ├──< Invoice ──< InvoiceLine / InvoiceEditLog
                    │               │        └──< Payment
                    │               ├──< FollowUp
                    │               └──< Conversation ──< ConversationMessage
                    ├──< Job ──< JobMaterial >── Material
                    ├──< Staff ──< Timesheet / PayrollRecord / TeamCheckin
                    ├──< Vehicle ──< FleetRepair
                    ├──< Expense / BankTransaction / CategorizationRule
                    │       └── BookkeepingTransaction (ledger)
                    ├──< ServiceCategory ──< PriceBookItem
                    ├──< BusinessSubscription ──< SubscriptionPaymentEvent
                    ├──< Notification / AiEventLog
                    └─── BusinessFinanceSettings
```

Key enums drive workflow state: `JobStatus`, `QuoteStatus`, `InvoiceStatus`, `SubscriptionStatus`, `FollowUpStatus`/`Channel`/`Type`, `ConversationChannel`/`Status`, `StaffRole`, `UserRole`, and more.

Migrations live in [prisma/migrations/](prisma/migrations/) and are applied automatically on `pnpm start` (via the `prestart` hook) or explicitly with `pnpm prisma:migrate:deploy`.

---

## External Integrations

| Service | Where | Used for |
|---|---|---|
| **Stripe** | [stripe_gateway.js](src/integrations/payments/stripe_gateway.js), webhooks controller | Payments, subscriptions/trials, webhook events |
| **Twilio** | [twilio_client.js](src/integrations/twilio/twilio_client.js), [twilio_gateway.js](src/integrations/sms/twilio_gateway.js) | Outbound SMS & calls, OTP/password-reset SMS |
| **SMTP (nodemailer)** | [email.service.js](src/domains/communications/email.service.js) | Transactional email |
| **Google Cloud Storage / Cloudinary** | [upload.service.js](src/domains/upload/upload.service.js) | File storage (`STORAGE_MODE` selects local/GCS/Cloudinary) |
| **AI service** (`AI_SERVICE_URL`) | AI bridge + ai domain | Voice/SMS AI agent; calls back via `/api/internal` |
| **pdfkit** | [invoice_pdf.service.js](src/domains/billing/invoice_pdf.service.js) | Invoice PDF generation |

---

## Environment Variables

Validated at boot by [src/config/env.js](src/config/env.js). Always required: `JWT_SECRET`, `DATABASE_URL`, `NODE_ENV`.

**Additionally required in production:** `STRIPE_SECRET_KEY`, `INTERNAL_API_KEY`, Twilio credentials (`TWILIO_ACCOUNT_SID` + either `TWILIO_AUTH_TOKEN` or `TWILIO_API_KEY_SID`/`TWILIO_API_KEY_SECRET`), a Twilio sender (`TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_PHONE_NUMBER`), and SMTP settings (`MAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, …).

| Group | Variables |
|---|---|
| Core | `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` |
| URLs / CORS | `BACKEND_URL`, `FRONTEND_URL`, `APP_FRONTEND_URL`, `ALLOWED_ORIGINS` (comma-separated) |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY`, `STRIPE_SUBSCRIPTION_*` (price/product/trial config) |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` or `TWILIO_API_KEY_SID`/`TWILIO_API_KEY_SECRET`, `TWILIO_PHONE_NUMBER`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_NUMBER_COUNTRY_CODE`, `TWILIO_*_WEBHOOK_URL`, `TWILIO_STATUS_CALLBACK_URL` |
| Email | `MAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM_NAME`, `MAIL_FROM_EMAIL` |
| Password reset | `PASSWORD_RESET_ALLOW_EMAIL`, `PASSWORD_RESET_ALLOW_SMS`, `PASSWORD_RESET_CODE_LENGTH`, `PASSWORD_RESET_CODE_TTL_MINUTES` |
| Storage | `STORAGE_MODE`, `GCS_BUCKET_NAME`, `GCS_PROJECT_ID`, `GCS_KEY_FILE`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`, `UPLOAD_RETURN_CLOUDINARY_URL` |
| AI / internal | `AI_SERVICE_URL`, `INTERNAL_API_KEY` |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |

---

## Scripts & Tooling

| Command | What it does |
|---|---|
| `pnpm dev` | Run with nodemon (auto-reload) |
| `pnpm start` | `prisma migrate deploy` then start the server |
| `pnpm test` | Jest, serial (`--runInBand`) |
| `pnpm test:legacy` | Node's built-in test runner |
| `pnpm prisma:generate` / `prisma:migrate` / `prisma:migrate:deploy` / `prisma:studio` | Prisma workflows |
| `pnpm export:ai-api` | [scripts/export-ai-api.js](scripts/export-ai-api.js) — export the AI-facing API description |
| `node scripts/audit-twilio-integration.js` | Audit the Twilio setup |
| `python scripts/generate_frontend_handoff_pdf.py` | Generate a frontend handoff PDF |

---

## Testing

Tests live in [test/](test/):

- `test/jest/*.spec.js` — ~21 Jest spec files covering auth flows (signup, OTP hardening, multi-channel password reset, onboarding/trial subscriptions), routing, billing/Stripe config, and the AI bridge.
- `test/ai_bridge.integration.test.js`, `test/dashboard.integration.test.js` — integration tests.

Run everything with:

```bash
pnpm test
```

Jest is configured in [jest.config.js](jest.config.js) and runs serially to avoid database contention.

---

## Docker & Deployment

The [Dockerfile](Dockerfile) builds a production image:

- Base: `node:20-bookworm-slim` with `openssl`/`ca-certificates` (needed by Prisma) and pnpm via corepack.
- Installs **all** dependencies (Prisma CLI must be present at runtime because `prestart` runs `prisma migrate deploy`).
- Runs as the non-root `node` user; `logs/` and `uploads/` are created and owned by it.
- Exposes port **3000** and defines a `HEALTHCHECK` against `/api/health`.

```bash
docker build -t ajicore-backend .
docker run --env-file .env -p 3000:3000 ajicore-backend
```

Deployment notes:

- Designed to sit behind a reverse proxy (Dokploy/ingress) — `trust proxy` is enabled and HTTPS is enforced via `x-forwarded-proto`.
- Migrations run automatically at container start.
- For production file uploads, prefer GCS/Cloudinary (`STORAGE_MODE`) over the local `uploads/` volume.

---

## API Documentation

| URL | Format |
|---|---|
| `/api/docs` | Swagger UI |
| `/api/reference` | Scalar (modern API reference) |
| `/api/docs.json` | Raw OpenAPI JSON (importable into Postman) |

The OpenAPI spec is assembled from JSDoc annotations in route files and [src/api/routes/docs/](src/api/routes/docs/) via `swagger-jsdoc` ([src/config/openapi.js](src/config/openapi.js)). Ready-made Postman collections are in [ajicore_postman_collection.json](ajicore_postman_collection.json) and [docs/api.postman_collection.json](docs/api.postman_collection.json), and [docs/frontend-backend-page-map.md](docs/frontend-backend-page-map.md) maps frontend pages to backend endpoints.
