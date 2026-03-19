/**
 * Quote Routes
 * Quotes flow: EstimateScheduled → Draft → Sent → Approved → Job (or Declined/Expired)
 * @swagger
 * tags:
 *   name: Quotes
 *   description: Quote management and lifecycle
 */

/**
 * @swagger
 * /api/quotes:
 *   get:
 *     summary: List quotes
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: query
 *         name: business_id
 *         required: true
 *         schema: {type: string}
 *       - in: query
 *         name: status
 *         schema: {type: string, enum: [EstimateScheduled, Draft, Sent, Approved, Declined, Expired]}
 *       - in: query
 *         name: customer_id
 *         schema: {type: string}
 *       - in: query
 *         name: page
 *         schema: {type: integer, default: 1}
 *       - in: query
 *         name: limit
 *         schema: {type: integer, default: 20}
 *     responses:
 *       200:
 *         description: Paginated list of quotes
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
 *                         $ref: '#/components/schemas/Quote'
 *       400:
 *         description: Missing required query param
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/quotes/{id}:
 *   get:
 *     summary: Get a single quote by ID
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string, format: uuid}
 *     responses:
 *       200:
 *         description: Quote retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quote'
 *       404:
 *         description: Quote not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/quotes:
 *   post:
 *     summary: Create a quote (estimate request)
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, customer_id]
 *             properties:
 *               business_id: {type: string}
 *               customer_id: {type: string}
 *               title: {type: string}
 *               description: {type: string}
 *               scheduled_estimate_date: {type: string, format: date-time}
 *               assigned_staff_id: {type: string}
 *               is_emergency: {type: boolean}
 *               source: {type: string, enum: [AI, Manual, SMS]}
 *     responses:
 *       201:
 *         description: Quote created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quote'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/quotes/{id}:
 *   patch:
 *     summary: Update a quote (e.g., pricing, status → Draft)
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string, format: uuid}
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: {type: string}
 *               description: {type: string}
 *               total_amount:
 *                 type: number
 *                 description: Set pricing before sending quote
 *               status:
 *                 type: string
 *                 enum: [Draft]
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Quote updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quote'
 *       404:
 *         description: Quote not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/quotes/{id}/send:
 *   post:
 *     summary: Mark quote as sent (sets sent_at and expiry)
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string, format: uuid}
 *     responses:
 *       200:
 *         description: Quote marked as sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quote'
 *       404:
 *         description: Quote not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/quotes/{id}/approve:
 *   post:
 *     summary: Approve quote and convert to Job
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string, format: uuid}
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assigned_staff_id: {type: string}
 *               scheduled_start_time: {type: string, format: date-time}
 *               scheduled_end_time: {type: string, format: date-time}
 *     responses:
 *       200:
 *         description: Quote approved and job created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 quote:
 *                   $ref: '#/components/schemas/Quote'
 *                 job:
 *                   $ref: '#/components/schemas/Job'
 *       404:
 *         description: Quote not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/quotes/{id}/decline:
 *   post:
 *     summary: Decline a quote
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string, format: uuid}
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for declining the quote
 *     responses:
 *       200:
 *         description: Quote declined
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quote'
 *       404:
 *         description: Quote not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/quotes/{id}:
 *   delete:
 *     summary: Delete a quote
 *     tags: [Quotes]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string, format: uuid}
 *     responses:
 *       204:
 *         description: Quote deleted successfully
 *       404:
 *         description: Quote not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */