/**
 * @swagger
 * tags:
 *   - name: Bookkeeping
 *     description: Bank transaction tracking and categorization rules
 *   - name: AI Logs
 *     description: AI event and activity log inspection
 *   - name: FollowUps
 *     description: Automated quote, invoice, and reminder follow-ups
 *   - name: TeamCheckins
 *     description: Staff safety and progress check-ins
 */

/**
 * @swagger
 * /api/price-book/categories:
 *   get:
 *     summary: List active service categories
 *     tags: [PriceBook]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Categories returned successfully
 *   post:
 *     summary: Create a service category
 *     tags: [PriceBook]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, name]
 *             properties:
 *               business_id: { type: string, format: uuid }
 *               name: { type: string }
 *               custom_description: { type: string }
 *     responses:
 *       201:
 *         description: Category created successfully
 *
 * /api/price-book/categories/{id}:
 *   patch:
 *     summary: Update a service category
 *     tags: [PriceBook]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               custom_description: { type: string }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Category updated successfully
 *   delete:
 *     summary: Soft-delete a service category
 *     tags: [PriceBook]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Category archived successfully
 *
 * /api/price-book/suggestions:
 *   get:
 *     summary: Get suggested price book items based on repeated jobs
 *     tags: [PriceBook]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Suggestions returned successfully
 *
 * /api/price-book/{id}:
 *   get:
 *     summary: Get a price book item by ID
 *     tags: [PriceBook]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Price book item returned successfully
 *   patch:
 *     summary: Update a price book item
 *     tags: [PriceBook]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               category_id: { type: string, format: uuid }
 *               can_quote_phone: { type: boolean }
 *               price_type: { type: string, enum: [Fixed, Range, NeedsOnsite] }
 *               price: { type: number }
 *               price_min: { type: number }
 *               price_max: { type: number }
 *               visit_type: { type: string, enum: [FreeEstimate, PaidServiceCall] }
 *               service_call_fee: { type: number }
 *               suggested_materials:
 *                 type: array
 *                 items: {}
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Price book item updated successfully
 *   delete:
 *     summary: Soft-delete a price book item
 *     tags: [PriceBook]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Price book item archived successfully
 */

/**
 * @swagger
 * /api/bookkeeping/transactions:
 *   get:
 *     summary: List bank transactions
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: is_income
 *         schema: { type: boolean }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Transaction list with pagination metadata
 *   post:
 *     summary: Create a bank transaction
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, amount, date]
 *             properties:
 *               business_id: { type: string, format: uuid }
 *               vendor: { type: string }
 *               amount: { type: number }
 *               date: { type: string, format: date-time }
 *               category: { type: string }
 *               source: { type: string }
 *               is_income: { type: boolean }
 *               receipt_url: { type: string, format: uri }
 *               raw_description: { type: string }
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *
 * /api/bookkeeping/transactions/bulk:
 *   post:
 *     summary: Bulk-create bank transactions
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, transactions]
 *             properties:
 *               business_id: { type: string, format: uuid }
 *               transactions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [amount, date]
 *                   properties:
 *                     vendor: { type: string }
 *                     amount: { type: number }
 *                     date: { type: string, format: date-time }
 *                     category: { type: string }
 *                     is_income: { type: boolean }
 *                     source: { type: string }
 *     responses:
 *       201:
 *         description: Transactions created successfully
 *
 * /api/bookkeeping/transactions/summary:
 *   get:
 *     summary: Get bookkeeping summary totals
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Summary totals returned successfully
 *
 * /api/bookkeeping/transactions/{id}:
 *   get:
 *     summary: Get a bank transaction by ID
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Transaction returned successfully
 *   patch:
 *     summary: Update a bank transaction
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vendor: { type: string }
 *               amount: { type: number }
 *               date: { type: string, format: date-time }
 *               category: { type: string }
 *               confidence: { type: number }
 *               source: { type: string }
 *               is_income: { type: boolean }
 *               receipt_url: { type: string, format: uri }
 *               raw_description: { type: string }
 *               normalized_vendor: { type: string }
 *     responses:
 *       200:
 *         description: Transaction updated successfully
 *   delete:
 *     summary: Delete a bank transaction
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Transaction deleted successfully
 *
 * /api/bookkeeping/transactions/{id}/categorize:
 *   patch:
 *     summary: Set category and confidence on a transaction
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category]
 *             properties:
 *               category: { type: string }
 *               confidence: { type: number }
 *     responses:
 *       200:
 *         description: Transaction categorized successfully
 *
 * /api/bookkeeping/rules:
 *   get:
 *     summary: List categorization rules
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rules returned successfully
 *   post:
 *     summary: Create a categorization rule
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, vendor_pattern, category]
 *             properties:
 *               business_id: { type: string, format: uuid }
 *               vendor_pattern: { type: string }
 *               category: { type: string }
 *               auto_apply: { type: boolean }
 *     responses:
 *       201:
 *         description: Rule created successfully
 *
 * /api/bookkeeping/rules/{id}:
 *   get:
 *     summary: Get a categorization rule by ID
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rule returned successfully
 *   patch:
 *     summary: Update a categorization rule
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vendor_pattern: { type: string }
 *               category: { type: string }
 *               auto_apply: { type: boolean }
 *               last_applied_at: { type: string, format: date-time }
 *               match_count: { type: integer }
 *     responses:
 *       200:
 *         description: Rule updated successfully
 *   delete:
 *     summary: Delete a categorization rule
 *     tags: [Bookkeeping]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rule deleted successfully
 */

/**
 * @swagger
 * /api/ai-logs:
 *   get:
 *     summary: List AI event logs
 *     tags: [AI Logs]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: event_type
 *         schema: { type: string }
 *       - in: query
 *         name: job_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: customer_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Log list with pagination metadata
 *   post:
 *     summary: Create an AI log entry
 *     tags: [AI Logs]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InternalActivityEventInput'
 *     responses:
 *       201:
 *         description: Log entry created successfully
 *
 * /api/ai-logs/event-types:
 *   get:
 *     summary: List distinct event types for a business
 *     tags: [AI Logs]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Event types returned successfully
 *
 * /api/ai-logs/{id}:
 *   get:
 *     summary: Get an AI log entry by ID
 *     tags: [AI Logs]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Log entry returned successfully
 *
 * /api/follow-ups:
 *   get:
 *     summary: List follow-ups
 *     tags: [FollowUps]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [Quote, Invoice, JobReminder, PaymentRequest] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [Scheduled, Sent, Delivered, Failed, Cancelled] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Follow-ups returned successfully
 *   post:
 *     summary: Create a follow-up
 *     tags: [FollowUps]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, type, reference_id]
 *             properties:
 *               business_id: { type: string, format: uuid }
 *               type: { type: string, enum: [Quote, Invoice, JobReminder, PaymentRequest] }
 *               reference_id: { type: string, format: uuid }
 *               customer_id: { type: string, format: uuid }
 *               attempt_number: { type: integer, minimum: 1 }
 *               scheduled_for: { type: string, format: date-time }
 *               channel: { type: string, enum: [SMS, Email, Call] }
 *               status: { type: string, enum: [Scheduled, Sent, Delivered, Failed, Cancelled] }
 *               tone: { type: string }
 *     responses:
 *       201:
 *         description: Follow-up created successfully
 *
 * /api/follow-ups/{id}:
 *   get:
 *     summary: Get a follow-up by ID
 *     tags: [FollowUps]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Follow-up returned successfully
 *   patch:
 *     summary: Update a follow-up
 *     tags: [FollowUps]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [Scheduled, Sent, Delivered, Failed, Cancelled] }
 *               sent_at: { type: string, format: date-time }
 *               scheduled_for: { type: string, format: date-time }
 *               attempt_number: { type: integer, minimum: 1 }
 *               tone: { type: string }
 *               channel: { type: string, enum: [SMS, Email, Call] }
 *     responses:
 *       200:
 *         description: Follow-up updated successfully
 *   delete:
 *     summary: Delete a follow-up
 *     tags: [FollowUps]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Follow-up deleted successfully
 *
 * /api/follow-ups/{id}/sent:
 *   post:
 *     summary: Mark a follow-up as sent
 *     tags: [FollowUps]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Follow-up marked as sent
 *
 * /api/follow-ups/{id}/cancel:
 *   post:
 *     summary: Cancel a follow-up
 *     tags: [FollowUps]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Follow-up cancelled
 */

/**
 * @swagger
 * /api/team-checkins:
 *   get:
 *     summary: List team check-ins
 *     tags: [TeamCheckins]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: job_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: staff_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [Pending, Received, Missed, Escalated] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Check-ins returned successfully
 *   post:
 *     summary: Schedule a team check-in
 *     tags: [TeamCheckins]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [staff_id, scheduled_at]
 *             properties:
 *               staff_id: { type: string, format: uuid }
 *               job_id: { type: string, format: uuid }
 *               scheduled_at: { type: string, format: date-time }
 *               message: { type: string }
 *     responses:
 *       201:
 *         description: Check-in scheduled successfully
 *
 * /api/team-checkins/{id}:
 *   get:
 *     summary: Get a team check-in by ID
 *     tags: [TeamCheckins]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Check-in returned successfully
 *   patch:
 *     summary: Update a team check-in
 *     tags: [TeamCheckins]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [Pending, Received, Missed, Escalated] }
 *               message: { type: string }
 *               received_at: { type: string, format: date-time }
 *               escalated: { type: boolean }
 *               escalated_at: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Check-in updated successfully
 *   delete:
 *     summary: Delete a team check-in
 *     tags: [TeamCheckins]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Check-in deleted successfully
 *
 * /api/team-checkins/{id}/receive:
 *   post:
 *     summary: Mark a team check-in as received
 *     tags: [TeamCheckins]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: Check-in marked as received
 *
 * /api/team-checkins/{id}/escalate:
 *   post:
 *     summary: Escalate a team check-in
 *     tags: [TeamCheckins]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Check-in escalated successfully
 */

/**
 * @swagger
 * /api/internal/schedule:
 *   get:
 *     summary: List internal job schedule data for AI systems
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Schedule returned successfully
 *
 * /api/internal/jobs:
 *   get:
 *     summary: List jobs for an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Jobs returned successfully
 *   post:
 *     summary: Create a job from an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, customer_id]
 *             properties:
 *               business_id: { type: string, format: uuid }
 *               customer_id: { type: string, format: uuid }
 *               assigned_staff_id: { type: string, format: uuid }
 *               type: { type: string, enum: [Job, ServiceCall] }
 *               title: { type: string }
 *               job_details: { type: string }
 *               price_book_item_id: { type: string, format: uuid }
 *               service_call_fee: { type: number }
 *               address: { type: string }
 *               service_type: { type: string }
 *               scheduled_start_time: { type: string, format: date-time }
 *               scheduled_end_time: { type: string, format: date-time }
 *               is_emergency: { type: boolean }
 *     responses:
 *       201:
 *         description: Job created successfully
 *
 * /api/internal/jobs/{id}:
 *   patch:
 *     summary: Update a job from an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assigned_staff_id: { type: string, format: uuid }
 *               status: { type: string, enum: [Scheduled, InProgress, Completed, Invoiced, Cancelled] }
 *               title: { type: string }
 *               job_details: { type: string }
 *               service_call_fee: { type: number }
 *               address: { type: string }
 *               service_type: { type: string }
 *               scheduled_start_time: { type: string, format: date-time }
 *               scheduled_end_time: { type: string, format: date-time }
 *               actual_start_time: { type: string, format: date-time }
 *               actual_end_time: { type: string, format: date-time }
 *               is_emergency: { type: boolean }
 *     responses:
 *       200:
 *         description: Job updated successfully
 *
 * /api/internal/jobs/{id}/start:
 *   post:
 *     summary: Start a job from an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job started successfully
 *
 * /api/internal/jobs/{id}/complete:
 *   post:
 *     summary: Complete a job from an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job completed successfully
 *
 * /api/internal/quotes:
 *   get:
 *     summary: List quotes for an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quotes returned successfully
 *   post:
 *     summary: Create a quote from an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, customer_id]
 *             properties:
 *               business_id: { type: string, format: uuid }
 *               customer_id: { type: string, format: uuid }
 *               assigned_staff_id: { type: string, format: uuid }
 *               title: { type: string }
 *               description: { type: string }
 *               price_book_item_id: { type: string, format: uuid }
 *               scheduled_estimate_date: { type: string, format: date-time }
 *               total_amount: { type: number }
 *               notes: { type: string }
 *               is_emergency: { type: boolean }
 *     responses:
 *       201:
 *         description: Quote created successfully
 *
 * /api/internal/quotes/{id}:
 *   patch:
 *     summary: Update a quote from an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assigned_staff_id: { type: string, format: uuid }
 *               status: { type: string, enum: [EstimateScheduled, Draft, Sent, Approved, Declined, Expired] }
 *               title: { type: string }
 *               description: { type: string }
 *               scheduled_estimate_date: { type: string, format: date-time }
 *               total_amount: { type: number }
 *               notes: { type: string }
 *               is_emergency: { type: boolean }
 *     responses:
 *       200:
 *         description: Quote updated successfully
 *
 * /api/internal/quotes/{id}/send:
 *   post:
 *     summary: Send a quote from an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quote sent successfully
 *
 * /api/internal/quotes/{id}/approve:
 *   post:
 *     summary: Approve a quote from an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quote approved successfully
 */

/**
 * @swagger
 * /api/internal/customers:
 *   get:
 *     summary: List customers for an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Customers returned successfully
 *   post:
 *     summary: Create a customer from an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, first_name, last_name]
 *             properties:
 *               business_id: { type: string, format: uuid }
 *               first_name: { type: string }
 *               last_name: { type: string }
 *               phone_number: { type: string }
 *               email: { type: string, format: email }
 *               address: { type: string }
 *               zip_code: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Customer created successfully
 *
 * /api/internal/customers/lookup:
 *   get:
 *     summary: Find a customer by phone for an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: phone
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Customer lookup result returned
 *
 * /api/internal/inventory:
 *   get:
 *     summary: List inventory items for an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Inventory returned successfully
 *
 * /api/internal/dashboard/summary:
 *   get:
 *     summary: Get dashboard summary for an internal AI client
 *     tags: [AI Bridge]
 *     security: [{apiKeyAuth: [], businessTokenAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [7d, 30d, 90d], default: 7d }
 *     responses:
 *       200:
 *         description: Dashboard summary returned successfully
 */

module.exports = {};
