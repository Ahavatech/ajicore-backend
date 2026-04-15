/**
 * Supplemental Swagger docs for operations that previously had no explicit request/response schema.
 */

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *
 * /api/auth/onboarding/skip-otp:
 *   post:
 *     tags: [Onboarding]
 *     summary: Skip phone verification and advance to step 3
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Phone verification skipped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user: { $ref: '#/components/schemas/UserProfile' }
 *                 onboarding_step: { type: integer, example: 3 }
 *
 * /api/auth/onboarding/available-numbers:
 *   get:
 *     tags: [Onboarding]
 *     summary: Search available AI phone numbers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [city, area_code, toll_free] }
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: area_code
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of available numbers
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AvailableNumbersResponse'
 *
 * /api/auth/onboarding/skip3:
 *   post:
 *     tags: [Onboarding]
 *     summary: Skip AI number setup and advance to step 4
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI number step skipped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user: { $ref: '#/components/schemas/UserProfile' }
 *                 onboarding_step: { type: integer, example: 4 }
 *
 * /api/dashboard/weekly-report:
 *   get:
 *     tags: [Dashboard]
 *     summary: Generate weekly business report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: start_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: end_date
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Weekly report payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WeeklyReportResponse'
 *
 * /api/customers/{id}:
 *   delete:
 *     tags: [Customers]
 *     summary: Delete a customer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Customer deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 *
 * /api/fleet/{id}:
 *   delete:
 *     tags: [Fleet]
 *     summary: Delete a vehicle
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vehicle deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 *
 * /api/inventory/{id}:
 *   delete:
 *     tags: [Inventory]
 *     summary: Delete a material
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Material deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 *
 * /api/jobs/{id}:
 *   delete:
 *     tags: [Jobs]
 *     summary: Delete a job
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 *
 * /api/quotes/{id}:
 *   delete:
 *     tags: [Quotes]
 *     summary: Delete a quote
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quote deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 *
 * /api/staff/{id}:
 *   delete:
 *     tags: [Team]
 *     summary: Delete a staff member
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Staff member deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 *
 * /api/price-book/categories:
 *   get:
 *     tags: [PriceBook]
 *     summary: List active service categories
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Categories returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   business_id: { type: string, format: uuid }
 *                   name: { type: string }
 *                   custom_description: { type: string, nullable: true }
 *                   is_active: { type: boolean }
 *   post:
 *     tags: [PriceBook]
 *     summary: Create a service category
 *     security: [{ bearerAuth: [] }]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 business_id: { type: string, format: uuid }
 *                 name: { type: string }
 *                 custom_description: { type: string, nullable: true }
 *                 is_active: { type: boolean }
 *
 * /api/price-book/categories/{id}:
 *   delete:
 *     tags: [PriceBook]
 *     summary: Delete a service category
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 *
 * /api/price-book:
 *   get:
 *     tags: [PriceBook]
 *     summary: List price book items
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Price book items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PriceBookItem'
 *
 * /api/price-book/suggestions:
 *   get:
 *     tags: [PriceBook]
 *     summary: Get suggested price book items
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Suggested price book items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PriceBookItem'
 *
 * /api/price-book/{id}:
 *   get:
 *     tags: [PriceBook]
 *     summary: Get a price book item by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Price book item retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PriceBookItem'
 *   delete:
 *     tags: [PriceBook]
 *     summary: Delete a price book item
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Price book item deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 *
 * /api/bookkeeping/transactions:
 *   get:
 *     tags: [Bookkeeping]
 *     summary: List bank transactions
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Transaction list with pagination metadata
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         additionalProperties: true
 *
 * /api/bookkeeping/transactions/summary:
 *   get:
 *     tags: [Bookkeeping]
 *     summary: Get bookkeeping summary totals
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Summary totals returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *
 * /api/bookkeeping/transactions/{id}:
 *   get:
 *     tags: [Bookkeeping]
 *     summary: Get a bank transaction by ID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Transaction returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *   delete:
 *     tags: [Bookkeeping]
 *     summary: Delete a bank transaction
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Transaction deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 *
 * /api/bookkeeping/rules:
 *   get:
 *     tags: [Bookkeeping]
 *     summary: List categorization rules
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Rules returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 additionalProperties: true
 *
 * /api/bookkeeping/rules/{id}:
 *   get:
 *     tags: [Bookkeeping]
 *     summary: Get a categorization rule by ID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Rule returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *   delete:
 *     tags: [Bookkeeping]
 *     summary: Delete a categorization rule
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Rule deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 *
 * /api/ai-logs:
 *   get:
 *     tags: [AI Logs]
 *     summary: List AI event logs
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Log list with pagination metadata
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/InternalActivityEvent'
 *
 * /api/ai-logs/event-types:
 *   get:
 *     tags: [AI Logs]
 *     summary: List distinct event types for a business
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Event types returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalEventTypeListResponse'
 *
 * /api/ai-logs/{id}:
 *   get:
 *     tags: [AI Logs]
 *     summary: Get an AI log entry by ID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Log entry returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalActivityEvent'
 *
 * /api/follow-ups:
 *   get:
 *     tags: [Follow-Ups]
 *     summary: List follow-ups
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Follow-ups returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         additionalProperties: true
 *
 * /api/follow-ups/{id}:
 *   get:
 *     tags: [Follow-Ups]
 *     summary: Get a follow-up by ID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Follow-up returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *   delete:
 *     tags: [Follow-Ups]
 *     summary: Delete a follow-up
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Follow-up deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 *
 * /api/follow-ups/{id}/sent:
 *   post:
 *     tags: [Follow-Ups]
 *     summary: Mark a follow-up as sent
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Follow-up marked as sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *
 * /api/follow-ups/{id}/cancel:
 *   post:
 *     tags: [Follow-Ups]
 *     summary: Cancel a follow-up
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Follow-up cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *
 * /api/team-checkins:
 *   get:
 *     tags: [Team Check-Ins]
 *     summary: List team check-ins
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Check-ins returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         additionalProperties: true
 *
 * /api/team-checkins/{id}:
 *   get:
 *     tags: [Team Check-Ins]
 *     summary: Get a team check-in by ID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Check-in returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *   delete:
 *     tags: [Team Check-Ins]
 *     summary: Delete a team check-in
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Check-in deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 *
 * /api/team-checkins/{id}/escalate:
 *   post:
 *     tags: [Team Check-Ins]
 *     summary: Escalate a team check-in
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Check-in escalated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *
 * /api/internal/schedule:
 *   get:
 *     tags: [AI Bridge]
 *     summary: List internal job schedule data for AI systems
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Schedule returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Job'
 *
 * /api/internal/jobs:
 *   get:
 *     tags: [AI Bridge]
 *     summary: List jobs for an internal AI client
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Jobs returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Job'
 *
 * /api/internal/jobs/{id}/start:
 *   post:
 *     tags: [AI Bridge]
 *     summary: Start a job from an internal AI client
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Job started successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 *
 * /api/internal/jobs/{id}/complete:
 *   post:
 *     tags: [AI Bridge]
 *     summary: Complete a job from an internal AI client
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Job completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 *
 * /api/internal/quotes:
 *   get:
 *     tags: [AI Bridge]
 *     summary: List quotes for an internal AI client
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Quotes returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Quote'
 *
 * /api/internal/quotes/{id}/send:
 *   post:
 *     tags: [AI Bridge]
 *     summary: Send a quote from an internal AI client
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Quote sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quote'
 *
 * /api/internal/quotes/{id}/approve:
 *   post:
 *     tags: [AI Bridge]
 *     summary: Approve a quote from an internal AI client
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Quote approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/Quote'
 *                 - $ref: '#/components/schemas/Job'
 *
 * /api/internal/customers:
 *   get:
 *     tags: [AI Bridge]
 *     summary: List customers for an internal AI client
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Customers returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Customer'
 *
 * /api/internal/customers/lookup:
 *   get:
 *     tags: [AI Bridge]
 *     summary: Find a customer by phone for an internal AI client
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Customer lookup result returned
 *         content:
 *           application/json:
 *             schema:
 *               nullable: true
 *               allOf:
 *                 - $ref: '#/components/schemas/Customer'
 *
 * /api/internal/inventory:
 *   get:
 *     tags: [AI Bridge]
 *     summary: List inventory items for an internal AI client
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Inventory returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Material'
 *
 * /api/internal/dashboard/summary:
 *   get:
 *     tags: [AI Bridge]
 *     summary: Get dashboard summary for an internal AI client
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Dashboard summary returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardSummary'
 *
 * /api/internal/ai/events:
 *   get:
 *     tags: [AI Bridge]
 *     summary: List raw internal AI events
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Events returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/InternalActivityEvent'
 *
 * /api/internal/ai/price-book:
 *   get:
 *     tags: [AI Bridge]
 *     summary: List internal AI price book items
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Price book returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PriceBookItem'
 *
 * /api/internal/ai/price-book/{id}:
 *   get:
 *     tags: [AI Bridge]
 *     summary: Get an internal AI price book item by ID
 *     security: [{ apiKeyAuth: [], businessTokenAuth: [] }]
 *     responses:
 *       200:
 *         description: Price book item returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PriceBookItem'
 *
 * /api/billing/expenses/{id}:
 *   delete:
 *     tags: [Expenses]
 *     summary: Delete an expense
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expense deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleMessageResponse'
 */

module.exports = {};
