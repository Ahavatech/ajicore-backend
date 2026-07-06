# Ajicore Frontend to Backend API Map

Updated: 2026-04-04

## Status

All meaningful backend-driven screens visible in the uploaded main prototype are backend-ready in the current repository.

This document is the handoff map for:
- frontend engineers using public app routes under `/api/...`
- AI engineers using internal AI routes under `/api/internal/ai/...`

## How To Read This Doc

- Frontend app routes use `Authorization: Bearer <jwt>`
- Internal AI routes use:
  - `x-api-key: <internal_api_key>`
  - `x-business-token: <business_internal_api_token>`
- Most business-scoped screens require `business_id`
- Modal, empty, success, and loading variants inherit the parent page endpoints unless stated otherwise
- Legacy internal bridge aliases still exist for compatibility, but the canonical internal naming is now `/api/internal/ai/...`

## Quick Coverage

| Page / Screen | Ready | Primary Route Family |
|---|---|---|
| Sign in | Yes | `/api/auth` |
| Sign up | Yes | `/api/auth` |
| Forgot password / reset password | Yes | `/api/auth` |
| Onboarding: business info | Yes | `/api/auth/onboarding/*` |
| Onboarding: OTP verification | Yes | `/api/auth/onboarding/*` |
| Onboarding: AI number setup | Yes | `/api/auth/onboarding/*` |
| Onboarding: service area | Yes | `/api/auth/onboarding/*` |
| Onboarding: logo / finish | Yes | `/api/auth/onboarding/*` |
| Dashboard | Yes | `/api/dashboard` |
| Jobs list / jobs for team members | Yes | `/api/jobs` |
| Job detail / edit job | Yes | `/api/jobs` |
| Schedule / calendar view | Yes | `/api/jobs/schedule` |
| Quotes / estimate appointments list | Yes | `/api/quotes` |
| Quote detail / edit quote | Yes | `/api/quotes` |
| Customer database | Yes | `/api/customers` |
| Customer detail / history | Yes | `/api/customers/:id` |
| Recent conversations | Yes | `/api/conversations` |
| Team / staff list | Yes | `/api/staff` |
| Staff detail | Yes | `/api/staff/:id` |
| Automated hourly check-ins | Yes | `/api/team-checkins` |
| Automated reminders / follow-ups | Yes | `/api/follow-ups` |
| Alerts settings | Yes | `/api/business/alerts` |
| Auto communication | Yes | `/api/business/communication` |
| Business profile / company settings | Yes | `/api/business/profile` |
| Billing / invoices | Yes | `/api/billing/invoices` |
| Payments | Yes | `/api/billing/payments` |
| Expenses | Yes | `/api/billing/expenses` |
| Price book / can-quote services | Yes | `/api/price-book` |
| Inventory / materials | Yes | `/api/inventory` |
| Fleet / vehicles | Yes | `/api/fleet` |
| Bookkeeping / transactions | Yes | `/api/bookkeeping/transactions` |
| Bookkeeping / rules | Yes | `/api/bookkeeping/rules` |
| AI receptionist / dispatcher integrations | Yes | `/api/internal/ai/*` |
| Pure UI states, loaders, success screens | No backend needed | Inherit parent page |

---

## 1. Sign In

**Purpose**

Authenticate an existing user and load their workspace state.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `POST` | `/api/auth/signin` | Email/password sign in |
| `POST` | `/api/auth/google` | Google sign in / sign up |
| `GET` | `/api/auth/me` | Restore current session after login |

**Typical frontend flow**

1. Submit credentials to `/api/auth/signin`
2. Store returned token
3. Call `/api/auth/me`
4. Route user either to onboarding or main app based on returned onboarding state

**AI/internal equivalent**

None. This is a frontend-only auth screen.

---

## 2. Sign Up

**Purpose**

Create a user account and start onboarding.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `POST` | `/api/auth/signup` | Email/password account creation |
| `POST` | `/api/auth/google` | Google-based account creation |
| `GET` | `/api/auth/me` | Confirm newly created user profile |

**Notes**

- The sign-up response should be treated as the start of onboarding, not as a finished business setup

**AI/internal equivalent**

None.

---

## 3. Forgot Password

**Purpose**

Start the password reset flow.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `POST` | `/api/auth/forgot-password` | Request reset code |

**Notes**

- Always returns a success-shaped response so the UI does not leak whether the email exists
- In non-production environments the response may include `dev_reset_code` for local testing

**AI/internal equivalent**

None.

---

## 4. Reset Password / Verify Code

**Purpose**

Validate a reset code and set a new password.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `POST` | `/api/auth/verify-reset-code` | Validate reset code before password submission |
| `POST` | `/api/auth/reset-password` | Complete password reset |
| `POST` | `/api/auth/signin` | Sign in with the new password |

---

## 5. Onboarding: Business / Contact Info

**Purpose**

Collect company and owner details.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `POST` | `/api/auth/onboarding/step2` | Save first name, last name, company info |
| `GET` | `/api/auth/me` | Refresh onboarding progress |

**Core fields**

- `first_name`
- `last_name`
- `company_name`
- `company_email`
- `business_structure`

---

## 6. Onboarding: Phone OTP Verification

**Purpose**

Verify the user phone before moving deeper into setup.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `POST` | `/api/auth/onboarding/send-otp` | Send OTP to phone |
| `POST` | `/api/auth/onboarding/verify-otp` | Verify OTP |
| `POST` | `/api/auth/onboarding/skip-otp` | Skip OTP flow |
| `GET` | `/api/auth/me` | Refresh onboarding progress |

---

## 7. Onboarding: AI Number Search / Number Provisioning

**Purpose**

Search and provision the dedicated AI phone number used by the business.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/auth/onboarding/available-numbers` | Search available numbers |
| `POST` | `/api/auth/onboarding/step3` | Provision chosen AI number |
| `POST` | `/api/auth/onboarding/skip3` | Skip number setup |
| `GET` | `/api/auth/me` | Refresh onboarding progress |

---

## 8. Onboarding: Service Area

**Purpose**

Define where the business operates and how mileage is handled.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `POST` | `/api/auth/onboarding/step4` | Save service area settings |
| `GET` | `/api/auth/me` | Refresh onboarding progress |

**Core fields**

- `home_base_zip`
- `service_radius_miles`
- `cost_per_mile_over_radius`

---

## 9. Onboarding: Logo / Finish Setup

**Purpose**

Finalize onboarding and enter the main application.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `POST` | `/api/auth/onboarding/step5` | Save logo URL and complete onboarding |
| `GET` | `/api/auth/me` | Confirm onboarding completed |

---

## 10. Dashboard

**Purpose**

Load the KPI cards, revenue chart, team status, today’s jobs, quotes, and recent activity.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/dashboard/summary?business_id=...` | Main KPI + list payload |
| `GET` | `/api/dashboard/revenue?business_id=...&period=7d` | Revenue KPI + chart |
| `GET` | `/api/dashboard/jobs-analytics?business_id=...&period=7d` | Jobs chart fallback / analytics |
| `GET` | `/api/dashboard/weekly-report?business_id=...` | Weekly summary view if shown |

**Notes**

- `todays_jobs`, `pending_quotes`, `recent_activity`, and `active_team` always return arrays
- Supported dashboard periods are `7d`, `30d`, and `90d`

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/dashboard/summary?business_id=...` | Internal summary for AI systems |
| `GET` | `/api/internal/ai/events?business_id=...` | Raw event feed used by AI and dashboard activity |

---

## 11. Jobs List / Jobs For Team Members

**Purpose**

Show scheduled, in-progress, completed, and filterable jobs.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/jobs?business_id=...` | Main jobs list |
| `GET` | `/api/jobs/schedule?business_id=...` | Schedule-oriented list |
| `GET` | `/api/staff?business_id=...` | Staff filter options |
| `GET` | `/api/customers?business_id=...` | Customer filter options |

**Important supported filters**

- `assigned_staff_id`
- `status`
- `type`
- `customer_id`
- `start_date`
- `end_date`
- `search`
- `page`
- `limit`

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/jobs?business_id=...` | AI-readable jobs list |
| `GET` | `/api/internal/ai/schedule?business_id=...` | AI schedule view |
| `GET` | `/api/internal/ai/staff?business_id=...` | Staff lookup for dispatch |

---

## 12. Job Detail / Edit Job

**Purpose**

View and update one job, start it, complete it, attach materials, and upload photos.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/jobs/:id` | Load job detail |
| `PATCH` | `/api/jobs/:id` | Edit job fields |
| `POST` | `/api/jobs/:id/start` | Mark job as started |
| `POST` | `/api/jobs/:id/complete` | Mark job as completed |
| `POST` | `/api/jobs/:id/materials` | Attach material usage |
| `POST` | `/api/jobs/:id/photos` | Attach photos |
| `GET` | `/api/price-book?business_id=...` | Service or price reference if needed |

**Important editable fields**

- `assigned_staff_id`
- `title`
- `job_details`
- `service_type`
- `address`
- `scheduled_start_time`
- `scheduled_end_time`
- `service_call_fee`
- `is_emergency`
- `status`

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/jobs/:id` | AI-readable job detail |
| `PATCH` | `/api/internal/ai/jobs/:id` | AI updates |
| `POST` | `/api/internal/ai/jobs/:id/start` | AI-triggered start |
| `POST` | `/api/internal/ai/jobs/:id/complete` | AI-triggered complete |

---

## 13. Schedule / Calendar View

**Purpose**

Show jobs in a schedule-oriented layout and validate staff availability.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/jobs/schedule?business_id=...` | Calendar/schedule data |
| `GET` | `/api/staff?business_id=...` | Staff list for calendar filters |
| `GET` | `/api/jobs?business_id=...&start_date=...&end_date=...` | Filtered date-range jobs |

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/schedule?business_id=...` | AI schedule read |
| `GET` | `/api/internal/ai/staff/availability?staff_id=...&start_time=...&end_time=...` | Availability check |

---

## 14. Quote / Estimate Appointments List

**Purpose**

Show estimate appointments and quote pipeline state.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/quotes?business_id=...` | Quote list |
| `GET` | `/api/customers?business_id=...` | Customer filter options |
| `GET` | `/api/staff?business_id=...` | Staff filter options |

**Important supported filters**

- `assigned_staff_id`
- `status`
- `customer_id`
- `start_date`
- `end_date`
- `search`
- `page`
- `limit`

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/quotes?business_id=...` | AI quote list |
| `GET` | `/api/internal/ai/customers?business_id=...` | Customer lookup |

---

## 15. Quote Detail / Edit Estimate

**Purpose**

Load one quote, edit it, send it, approve it, or decline it.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/quotes/:id` | Load quote detail |
| `PATCH` | `/api/quotes/:id` | Edit quote |
| `POST` | `/api/quotes/:id/send` | Send quote |
| `POST` | `/api/quotes/:id/approve` | Approve quote and convert to job |
| `POST` | `/api/quotes/:id/decline` | Decline quote |
| `GET` | `/api/price-book?business_id=...` | Price lookup / line item selection |
| `GET` | `/api/price-book/suggestions?business_id=...` | Quoteable item suggestions |

**Notes**

- Quote detail already includes customer, assigned staff, conversion state, and related follow-up context used by the UI

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/quotes/:id` | AI quote detail |
| `PATCH` | `/api/internal/ai/quotes/:id` | AI quote update |
| `POST` | `/api/internal/ai/quotes/:id/send` | AI quote send |
| `POST` | `/api/internal/ai/quotes/:id/approve` | AI approve |
| `POST` | `/api/internal/ai/quotes/:id/decline` | AI decline |

---

## 16. “Can Quote” / Service Lookup Modal

**Purpose**

Look up quoteable services and service call pricing while editing jobs or quotes.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/price-book?business_id=...&search=...` | Search price book items |
| `GET` | `/api/price-book/suggestions?business_id=...` | Suggested services |
| `GET` | `/api/price-book/categories?business_id=...` | Category filter |

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/price-lookup?business_id=...&search=...` | AI lookup for quoting logic |
| `GET` | `/api/internal/ai/price-book?business_id=...` | AI full item list |
| `GET` | `/api/internal/ai/price-book/:id` | AI item detail |

---

## 17. Customer Database

**Purpose**

List, search, create, update, and delete customers.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/customers?business_id=...` | Customer list |
| `GET` | `/api/customers/lookup?business_id=...&phone=...` | Lookup by phone |
| `POST` | `/api/customers` | Create customer |
| `PATCH` | `/api/customers/:id` | Update customer |
| `DELETE` | `/api/customers/:id` | Delete customer |

---

## 18. Customer Detail / Customer History

**Purpose**

Show profile, jobs, quotes, invoice history, and interaction history for one customer.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/customers/:id` | Customer profile |
| `GET` | `/api/customers/:id/history` | Customer related jobs / quotes / invoices history |
| `GET` | `/api/conversations/:customer_id?business_id=...` | Communication history for that customer |

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/customers/:id` | AI customer detail |
| `GET` | `/api/internal/ai/customers/:id/history` | AI customer history |
| `GET` | `/api/internal/ai/conversations/:customer_id?business_id=...` | AI conversation history |

---

## 19. Recent Conversations

**Purpose**

List SMS/call conversation threads and open the message history for one customer.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/conversations?business_id=...&channel=&search=&page=&limit=` | Conversation list |
| `GET` | `/api/conversations/:customer_id?business_id=...` | Conversation detail |
| `GET` | `/api/ai-logs?business_id=...` | Optional raw log inspection view |

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/conversations?business_id=...` | AI conversation list |
| `GET` | `/api/internal/ai/conversations/:customer_id?business_id=...` | AI conversation detail |
| `GET` | `/api/internal/ai/events?business_id=...` | Raw event feed |
| `GET` | `/api/internal/ai/events/event-types?business_id=...` | Available event types |

---

## 20. Team / Staff List

**Purpose**

Show technicians and office staff with active job and timesheet context.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/staff?business_id=...` | Staff list |
| `POST` | `/api/staff` | Create staff |
| `GET` | `/api/staff/timesheets?business_id=...` | Timesheet view if shown |
| `GET` | `/api/staff/payroll?business_id=...` | Payroll summary if shown |

**Notes**

- Staff list/detail already expose `check_in_frequency_hours`, `active_job_summary`, and `has_open_timesheet`

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/staff?business_id=...` | AI staff list |
| `GET` | `/api/internal/ai/staff/:id` | AI staff detail |
| `GET` | `/api/internal/ai/staff/availability?...` | Scheduling / dispatch checks |

---

## 21. Staff Detail / Staff Edit

**Purpose**

View one team member and update profile, rates, or check-in frequency.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/staff/:id` | Staff detail |
| `PATCH` | `/api/staff/:id` | Update staff fields |
| `DELETE` | `/api/staff/:id` | Remove staff member |
| `POST` | `/api/staff/:id/clock-in` | Manual clock-in |
| `POST` | `/api/staff/:id/clock-out` | Manual clock-out |

**Important editable fields**

- `name`
- `role`
- `hourly_rate`
- `check_in_frequency_hours`

---

## 22. Automated Hourly Check-Ins

**Purpose**

Track recurring check-ins for field staff while they are on jobs.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/team-checkins?business_id=...&staff_id=&job_id=&status=&start_date=&end_date=` | List check-ins |
| `GET` | `/api/team-checkins/:id` | Check-in detail |
| `POST` | `/api/team-checkins` | Create check-in |
| `PATCH` | `/api/team-checkins/:id` | Update check-in |
| `POST` | `/api/team-checkins/:id/receive` | Mark check-in received |
| `POST` | `/api/team-checkins/:id/escalate` | Escalate missed check-in |
| `DELETE` | `/api/team-checkins/:id` | Delete check-in |
| `PATCH` | `/api/staff/:id` | Update default `check_in_frequency_hours` |
| `PATCH` | `/api/business/automation` | Update global automation defaults |

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/team-checkins?business_id=...` | AI check-ins list |
| `POST` | `/api/internal/ai/team-checkins` | AI create |
| `PATCH` | `/api/internal/ai/team-checkins/:id` | AI update |
| `POST` | `/api/internal/ai/team-checkins/:id/receive` | AI receive |
| `POST` | `/api/internal/ai/team-checkins/:id/escalate` | AI escalate |

---

## 23. Automated Reminders / Follow-Ups

**Purpose**

Manage quote follow-ups, invoice reminders, and other reminder automation.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/follow-ups?business_id=...` | Follow-up list |
| `GET` | `/api/follow-ups/:id` | Follow-up detail |
| `POST` | `/api/follow-ups` | Create follow-up |
| `PATCH` | `/api/follow-ups/:id` | Update follow-up |
| `POST` | `/api/follow-ups/:id/sent` | Mark reminder sent |
| `POST` | `/api/follow-ups/:id/cancel` | Cancel reminder |
| `DELETE` | `/api/follow-ups/:id` | Delete follow-up |
| `GET` | `/api/business/automation?business_id=...` | Read automation config |
| `PATCH` | `/api/business/automation` | Update reminder automation config |

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/follow-ups?business_id=...` | AI list |
| `POST` | `/api/internal/ai/follow-ups` | AI create |
| `PATCH` | `/api/internal/ai/follow-ups/:id` | AI update |
| `POST` | `/api/internal/ai/follow-ups/:id/sent` | AI mark sent |
| `POST` | `/api/internal/ai/follow-ups/:id/cancel` | AI cancel |

---

## 24. Alerts Settings

**Purpose**

Configure alert toggles for missed calls, overdue invoices, failed check-ins, and related notifications.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/business/alerts?business_id=...` | Read alert settings |
| `PATCH` | `/api/business/alerts` | Update alert settings |

**AI/internal equivalent**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/business/alerts?business_id=...` | AI-readable alerts settings |

---

## 25. Auto Communication

**Purpose**

Configure messaging behavior, AI receptionist persona, and communication defaults.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/business/communication?business_id=...` | Read communication settings |
| `PATCH` | `/api/business/communication` | Update communication settings |

**Common fields**

- `send_booking_confirmations`
- `send_job_updates`
- `send_invoice_reminders`
- `missed_call_text_back`
- `ai_receptionist_name`
- `voice_gender`
- `ai_business_description`
- `unknown_service_handling`
- `unknown_service_call_fee`

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/business/communication?business_id=...` | AI-readable communication settings |
| `GET` | `/api/internal/ai/business-config?business_id=...` | Full AI operating context |

---

## 26. Business Profile / Company Settings

**Purpose**

Edit company identity, phone numbers, service area, business hours, and profile-level metadata.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/business/profile?business_id=...` | Read business profile |
| `PATCH` | `/api/business/profile` | Update business profile |
| `GET` | `/api/auth/internal-api-token?business_id=...` | Get business internal token if the settings UI exposes it |
| `PATCH` | `/api/auth/change-password` | Change account password from settings |

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/business/profile?business_id=...` | AI-readable business profile |
| `GET` | `/api/internal/ai/business-config?business_id=...` | Full config for AI receptionist / dispatcher |

---

## 27. Billing / Invoices

**Purpose**

Show invoice list, invoice detail, invoice totals, and invoice status actions.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/billing/invoices?business_id=...` | Invoice list |
| `GET` | `/api/billing/invoices/job/:jobId` | Invoices for one job |
| `GET` | `/api/billing/invoices/:id` | Invoice detail |
| `GET` | `/api/billing/invoices/:id/total` | Invoice totals |
| `POST` | `/api/billing/invoices` | Create invoice |
| `PATCH` | `/api/billing/invoices/:id` | Update invoice |
| `POST` | `/api/billing/invoices/:id/send` | Send invoice |
| `POST` | `/api/billing/invoices/:id/void` | Void invoice |
| `POST` | `/api/billing/invoices/:id/refund` | Refund invoice |

**AI/internal equivalents**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/invoices?business_id=...` | AI invoice list |
| `GET` | `/api/internal/ai/invoices/:id` | AI invoice detail |
| `GET` | `/api/internal/ai/invoices/:id/total` | AI invoice totals |
| `POST` | `/api/internal/ai/invoices` | AI create invoice |
| `PATCH` | `/api/internal/ai/invoices/:id` | AI update invoice |
| `POST` | `/api/internal/ai/invoices/:id/send` | AI send invoice |
| `POST` | `/api/internal/ai/invoices/:id/void` | AI void invoice |
| `POST` | `/api/internal/ai/invoices/:id/refund` | AI refund invoice |

---

## 28. Payments

**Purpose**

Capture or record payment against an invoice.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `POST` | `/api/billing/payments/:invoiceId` | Process payment |

**AI/internal equivalent**

| Method | Endpoint | Use |
|---|---|---|
| `POST` | `/api/internal/ai/payments/:invoiceId` | AI-recorded payment |

---

## 29. Expenses

**Purpose**

Track business expenses for billing/bookkeeping screens.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/billing/expenses?business_id=...` | Expense list |
| `POST` | `/api/billing/expenses` | Create expense |
| `PATCH` | `/api/billing/expenses/:id` | Update expense |
| `DELETE` | `/api/billing/expenses/:id` | Delete expense |

---

## 30. Price Book

**Purpose**

Manage service categories and quoteable/service-call items.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/price-book/categories?business_id=...` | Category list |
| `POST` | `/api/price-book/categories` | Create category |
| `PATCH` | `/api/price-book/categories/:id` | Update category |
| `DELETE` | `/api/price-book/categories/:id` | Delete category |
| `GET` | `/api/price-book?business_id=...` | Item list |
| `GET` | `/api/price-book/:id` | Item detail |
| `GET` | `/api/price-book/suggestions?business_id=...` | Suggestions |
| `POST` | `/api/price-book` | Create item |
| `PATCH` | `/api/price-book/:id` | Update item |
| `DELETE` | `/api/price-book/:id` | Delete item |

---

## 31. Inventory / Materials

**Purpose**

Track stocked materials, restocks, and deduct usage from jobs.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/inventory?business_id=...` | Material list |
| `GET` | `/api/inventory/:id` | Material detail |
| `POST` | `/api/inventory` | Create material |
| `PATCH` | `/api/inventory/:id` | Update material |
| `POST` | `/api/inventory/:id/restock` | Restock material |
| `DELETE` | `/api/inventory/:id` | Delete material |
| `POST` | `/api/inventory/deduct/:jobId` | Deduct material usage for a job |

**AI/internal equivalent**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/inventory?business_id=...` | AI inventory read |

---

## 32. Fleet / Vehicles

**Purpose**

Manage vehicles and maintenance alert data.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/fleet?business_id=...` | Vehicle list |
| `GET` | `/api/fleet/maintenance-alerts?business_id=...` | Maintenance alerts |
| `GET` | `/api/fleet/:id` | Vehicle detail |
| `POST` | `/api/fleet` | Create vehicle |
| `PATCH` | `/api/fleet/:id` | Update vehicle |
| `PATCH` | `/api/fleet/:id/mileage` | Update mileage |
| `DELETE` | `/api/fleet/:id` | Delete vehicle |

---

## 33. Bookkeeping / Transactions

**Purpose**

List and manage transactions plus transaction summary data.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/bookkeeping/transactions?business_id=...` | Transaction list |
| `GET` | `/api/bookkeeping/transactions/summary?business_id=...` | Summary cards / totals |
| `GET` | `/api/bookkeeping/transactions/:id` | Transaction detail |
| `POST` | `/api/bookkeeping/transactions` | Create transaction |
| `POST` | `/api/bookkeeping/transactions/bulk` | Bulk import/create |
| `PATCH` | `/api/bookkeeping/transactions/:id` | Update transaction |
| `PATCH` | `/api/bookkeeping/transactions/:id/categorize` | Categorize transaction |
| `DELETE` | `/api/bookkeeping/transactions/:id` | Delete transaction |

---

## 34. Bookkeeping / Rules

**Purpose**

Manage categorization rules used by bookkeeping workflows.

**Frontend endpoints**

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/bookkeeping/rules?business_id=...` | Rules list |
| `GET` | `/api/bookkeeping/rules/:id` | Rule detail |
| `POST` | `/api/bookkeeping/rules` | Create rule |
| `PATCH` | `/api/bookkeeping/rules/:id` | Update rule |
| `DELETE` | `/api/bookkeeping/rules/:id` | Delete rule |

---

## 35. AI Receptionist / Dispatcher Integration Surface

**Purpose**

This is the AI engineer surface, not a normal browser page. It powers inbound SMS, inbound calls, booking, business config, event logging, and AI-side CRUD access.

**Canonical internal endpoints**

### Inbound provider webhooks

| Method | Endpoint | Use |
|---|---|---|
| `POST` | `/api/internal/ai/sms/incoming` | Receive inbound SMS |
| `POST` | `/api/internal/ai/calls/incoming` | Receive inbound call |
| `POST` | `/api/internal/ai/calls/status` | Receive call status updates |

### AI booking and config

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/business-config?business_id=...` | Full AI operating context |
| `GET` | `/api/internal/ai/price-lookup?business_id=...` | AI service lookup |
| `POST` | `/api/internal/ai/radius-check` | Service radius check |
| `POST` | `/api/internal/ai/book` | Create quote/job/service call from AI |
| `POST` | `/api/internal/ai/sms/send` | Outbound SMS from AI |

### AI read/write bridge

| Method | Endpoint | Use |
|---|---|---|
| `GET` | `/api/internal/ai/jobs` | Jobs list |
| `GET` | `/api/internal/ai/quotes` | Quotes list |
| `GET` | `/api/internal/ai/customers` | Customers list |
| `GET` | `/api/internal/ai/staff` | Staff list |
| `GET` | `/api/internal/ai/invoices` | Invoices list |
| `GET` | `/api/internal/ai/follow-ups` | Follow-ups list |
| `GET` | `/api/internal/ai/team-checkins` | Team check-ins list |
| `GET` | `/api/internal/ai/events` | Event log list |
| `GET` | `/api/internal/ai/conversations` | Conversation list |
| `GET` | `/api/internal/ai/business/profile` | Business profile |
| `GET` | `/api/internal/ai/business/alerts` | Alerts config |
| `GET` | `/api/internal/ai/business/automation` | Automation config |
| `GET` | `/api/internal/ai/business/communication` | Communication config |

---

## 36. UI-Only Screens / No Backend Needed

These screens do not require their own API surface:

- splash screens
- illustration-only auth variants
- success confirmation screens
- empty states
- loaders
- modal open/close states
- static cards that only restyle existing parent-page data

These should reuse the parent page endpoints already listed above.

---

## Final Recommendation To Frontend Team

Frontend can proceed on all meaningful product pages in the uploaded main prototype.

Use this rule of thumb:
- browser UI should use public routes under `/api/...`
- AI/receptionist/dispatcher services should use internal routes under `/api/internal/ai/...`
- if a screen is only a visual variant of another screen, reuse the parent screen’s endpoints from this document

