const { BUSINESS_ID, VALID_UUID, abs, createRouteHarness } = require('./helpers/routeHarness');

const standardModules = [
  {
    name: 'auth.routes',
    routeModulePath: 'src/api/routes/auth.routes.js',
    basePath: '/api/auth',
    controllerModules: [
      {
        modulePath: 'src/domains/auth/auth.controller.js',
        handlers: [
          'signup',
          'googleSignup',
          'signin',
          'forgotPassword',
          'verifyResetCode',
          'resetPassword',
          'onboardingStep2',
          'sendOtp',
          'verifyOtp',
          'skipOtp',
          'getAvailableNumbers',
          'onboardingStep3',
          'skipStep3',
          'onboardingStep4',
          'onboardingStep5',
          'getMe',
          'getInternalApiToken',
          'changePassword',
        ],
      },
    ],
    routes: [
      { method: 'post', path: '/signup', handler: 'signup', body: { email: 'a@example.com', password: 'secret' }, invalidBody: { email: 'a@example.com' } },
      { method: 'post', path: '/google', handler: 'googleSignup', body: { google_id: 'gid', email: 'a@example.com' }, invalidBody: { email: 'a@example.com' } },
      { method: 'post', path: '/signin', handler: 'signin', body: { email: 'a@example.com', password: 'secret' }, invalidBody: { email: 'a@example.com' } },
      { method: 'post', path: '/forgot-password', handler: 'forgotPassword', body: { email: 'a@example.com' }, invalidBody: {} },
      { method: 'post', path: '/verify-reset-code', handler: 'verifyResetCode', body: { email: 'a@example.com', code: '12345' }, invalidBody: { email: 'a@example.com' } },
      { method: 'post', path: '/reset-password', handler: 'resetPassword', body: { email: 'a@example.com', code: '12345', new_password: 'new-secret' }, invalidBody: { email: 'a@example.com', code: '12345' } },
      { method: 'post', path: '/onboarding/step2', handler: 'onboardingStep2', body: { first_name: 'Aji', last_name: 'Core', company_name: 'Ajicore', company_email: 'team@example.com', business_structure: 'LLC' }, failureAuth: 'requireAuth' },
      { method: 'post', path: '/onboarding/send-otp', handler: 'sendOtp', body: { phone_number: '+15555550123' }, failureAuth: 'requireAuth' },
      { method: 'post', path: '/onboarding/verify-otp', handler: 'verifyOtp', body: { otp: '12345' }, failureAuth: 'requireAuth' },
      { method: 'post', path: '/onboarding/skip-otp', handler: 'skipOtp', failureAuth: 'requireAuth' },
      { method: 'get', path: '/onboarding/available-numbers', handler: 'getAvailableNumbers', failureAuth: 'requireAuth' },
      { method: 'post', path: '/onboarding/step3', handler: 'onboardingStep3', body: { phone_number: '+15555550123', search_type: 'area_code' }, failureAuth: 'requireAuth' },
      { method: 'post', path: '/onboarding/skip3', handler: 'skipStep3', failureAuth: 'requireAuth' },
      { method: 'post', path: '/onboarding/step4', handler: 'onboardingStep4', body: { home_base_zip: '75001', service_radius_miles: 25, cost_per_mile_over_radius: 3 }, failureAuth: 'requireAuth' },
      { method: 'post', path: '/onboarding/step5', handler: 'onboardingStep5', failureAuth: 'requireAuth' },
      { method: 'get', path: '/me', handler: 'getMe', failureAuth: 'requireAuth' },
      { method: 'get', path: '/internal-api-token', handler: 'getInternalApiToken', failureAuth: 'requireAuth' },
      { method: 'patch', path: '/change-password', handler: 'changePassword', body: { current_password: 'old', new_password: 'new' }, failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'customers.routes',
    routeModulePath: 'src/api/routes/customers.routes.js',
    basePath: '/api/customers',
    controllerModules: [{ modulePath: 'src/domains/customers/customer.controller.js', handlers: ['getAll', 'getMetrics', 'findByPhone', 'getById', 'getHistory', 'getBilling', 'getSchedule', 'create', 'update', 'remove'] }],
    routes: [
      { method: 'get', path: '/', handler: 'getAll', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/metrics', handler: 'getMetrics', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/lookup', handler: 'findByPhone', query: { business_id: BUSINESS_ID, phone: '+15555550123' }, invalidQuery: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}`, handler: 'getById', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}/history`, handler: 'getHistory', query: { business_id: BUSINESS_ID }, invalidQuery: {}, invalidPath: '/bad-uuid/history', failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}/billing`, handler: 'getBilling', query: { business_id: BUSINESS_ID }, invalidQuery: {}, invalidPath: '/bad-uuid/billing', failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}/schedule`, handler: 'getSchedule', query: { business_id: BUSINESS_ID }, invalidQuery: {}, invalidPath: '/bad-uuid/schedule', failureAuth: 'requireAuth' },
      { method: 'post', path: '/', handler: 'create', body: { business_id: BUSINESS_ID, first_name: 'Aji', last_name: 'Core' }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'patch', path: `/${VALID_UUID}`, handler: 'update', body: { first_name: 'Updated' }, invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'delete', path: `/${VALID_UUID}`, handler: 'remove', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'jobs.routes',
    routeModulePath: 'src/api/routes/jobs.routes.js',
    basePath: '/api/jobs',
    controllerModules: [{ modulePath: 'src/domains/jobs/job.controller.js', handlers: ['getAllJobs', 'getSchedule', 'checkAvailability', 'getJobById', 'createJob', 'updateJob', 'startJob', 'completeJob', 'addMaterials', 'addPhotos', 'deleteJob'] }],
    routes: [
      { method: 'get', path: '/', handler: 'getAllJobs', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/schedule', handler: 'getSchedule', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/availability', handler: 'checkAvailability', query: { staff_id: VALID_UUID, start_time: '2026-04-05T10:00:00.000Z', end_time: '2026-04-05T11:00:00.000Z' }, invalidQuery: { staff_id: VALID_UUID, start_time: '2026-04-05T10:00:00.000Z' }, failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}`, handler: 'getJobById', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: '/', handler: 'createJob', body: { business_id: BUSINESS_ID, customer_id: VALID_UUID }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth' },
      { method: 'patch', path: `/${VALID_UUID}`, handler: 'updateJob', body: { title: 'Updated job' }, invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/start`, handler: 'startJob', failureAuth: 'requireAuth', invalidPath: '/bad-uuid/start' },
      { method: 'post', path: `/${VALID_UUID}/complete`, handler: 'completeJob', failureAuth: 'requireAuth', invalidPath: '/bad-uuid/complete' },
      { method: 'post', path: `/${VALID_UUID}/materials`, handler: 'addMaterials', body: { materials: [{ material_id: VALID_UUID, quantity: 1 }] }, invalidBody: {}, failureAuth: 'requireAuth', invalidPath: '/bad-uuid/materials' },
      { method: 'post', path: `/${VALID_UUID}/photos`, handler: 'addPhotos', body: { photo_urls: ['https://example.com/a.jpg'] }, invalidBody: {}, failureAuth: 'requireAuth', invalidPath: '/bad-uuid/photos' },
      { method: 'delete', path: `/${VALID_UUID}`, handler: 'deleteJob', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'quotes.routes',
    routeModulePath: 'src/api/routes/quotes.routes.js',
    basePath: '/api/quotes',
    controllerModules: [{ modulePath: 'src/domains/quotes/quote.controller.js', handlers: ['getAll', 'getById', 'create', 'update', 'sendQuote', 'approve', 'accept', 'convert', 'decline', 'updateSiteNotes', 'remove'] }],
    routes: [
      { method: 'get', path: '/', handler: 'getAll', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}`, handler: 'getById', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: '/', handler: 'create', body: { business_id: BUSINESS_ID, customer_id: VALID_UUID }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth' },
      { method: 'patch', path: `/${VALID_UUID}`, handler: 'update', body: { status: 'Sent' }, invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/send`, handler: 'sendQuote', invalidPath: '/bad-uuid/send', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/approve`, handler: 'approve', body: { title: 'Approved job' }, invalidPath: '/bad-uuid/approve', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/accept`, handler: 'accept', invalidPath: '/bad-uuid/accept', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/convert`, handler: 'convert', body: { title: 'Approved job' }, invalidPath: '/bad-uuid/convert', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/decline`, handler: 'decline', body: { reason: 'No thanks' }, invalidPath: '/bad-uuid/decline', failureAuth: 'requireAuth' },
      { method: 'patch', path: `/${VALID_UUID}/site-notes`, handler: 'updateSiteNotes', body: { notes: 'Tech found shutoff valve behind dryer.', photos: ['https://example.com/site-note.jpg'] }, invalidPath: '/bad-uuid/site-notes', failureAuth: 'requireAuth' },
      { method: 'delete', path: `/${VALID_UUID}`, handler: 'remove', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'billing.routes',
    routeModulePath: 'src/api/routes/billing.routes.js',
    basePath: '/api/billing',
    controllerModules: [{ modulePath: 'src/domains/billing/invoice.controller.js', handlers: ['getStripeConfig', 'getAll', 'getInvoicesByJob', 'getById', 'downloadInvoicePdf', 'getTotal', 'createInvoice', 'updateInvoice', 'sendInvoice', 'voidInvoice', 'refundInvoice', 'processPayment', 'getExpenses', 'createExpense', 'updateExpense', 'deleteExpense'] }],
    routes: [
      { method: 'get', path: '/stripe-config', handler: 'getStripeConfig', skipFailure: true },
      { method: 'get', path: '/invoices', handler: 'getAll', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: `/invoices/job/${VALID_UUID}`, handler: 'getInvoicesByJob', invalidPath: '/invoices/job/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'get', path: `/invoices/${VALID_UUID}`, handler: 'getById', invalidPath: '/invoices/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'get', path: `/invoices/${VALID_UUID}/pdf`, handler: 'downloadInvoicePdf', invalidPath: '/invoices/bad-uuid/pdf', failureAuth: 'requireAuth' },
      { method: 'get', path: `/invoices/${VALID_UUID}/total`, handler: 'getTotal', invalidPath: '/invoices/bad-uuid/total', failureAuth: 'requireAuth' },
      { method: 'post', path: '/invoices', handler: 'createInvoice', body: { business_id: BUSINESS_ID, customer_id: VALID_UUID }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'patch', path: `/invoices/${VALID_UUID}`, handler: 'updateInvoice', body: { status: 'Sent' }, invalidPath: '/invoices/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: `/invoices/${VALID_UUID}/send`, handler: 'sendInvoice', invalidPath: '/invoices/bad-uuid/send', failureAuth: 'requireAuth' },
      { method: 'post', path: `/invoices/${VALID_UUID}/void`, handler: 'voidInvoice', invalidPath: '/invoices/bad-uuid/void', failureAuth: 'requireAuth' },
      { method: 'post', path: `/invoices/${VALID_UUID}/refund`, handler: 'refundInvoice', invalidPath: '/invoices/bad-uuid/refund', failureAuth: 'requireAuth' },
      { method: 'post', path: `/payments/${VALID_UUID}`, handler: 'processPayment', body: { amount: 100 }, invalidBody: {}, invalidPath: '/payments/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'get', path: '/expenses', handler: 'getExpenses', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'post', path: '/expenses', handler: 'createExpense', body: { business_id: BUSINESS_ID, amount: 25 }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth' },
      { method: 'patch', path: `/expenses/${VALID_UUID}`, handler: 'updateExpense', body: { amount: 50 }, invalidPath: '/expenses/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'delete', path: `/expenses/${VALID_UUID}`, handler: 'deleteExpense', invalidPath: '/expenses/bad-uuid', failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'inventory.routes',
    routeModulePath: 'src/api/routes/inventory.routes.js',
    basePath: '/api/inventory',
    controllerModules: [{ modulePath: 'src/domains/inventory/material.controller.js', handlers: ['getAllMaterials', 'getMaterialById', 'createMaterial', 'updateMaterial', 'restockMaterial', 'removeMaterial', 'deductMaterials'] }],
    routes: [
      { method: 'get', path: '/', handler: 'getAllMaterials', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}`, handler: 'getMaterialById', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: '/', handler: 'createMaterial', body: { business_id: BUSINESS_ID, name: 'Copper pipe' }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth' },
      { method: 'patch', path: `/${VALID_UUID}`, handler: 'updateMaterial', body: { name: 'Updated material' }, invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/restock`, handler: 'restockMaterial', body: { quantity: 10 }, invalidBody: {}, invalidPath: '/bad-uuid/restock', failureAuth: 'requireAuth' },
      { method: 'delete', path: `/${VALID_UUID}`, handler: 'removeMaterial', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: `/deduct/${VALID_UUID}`, handler: 'deductMaterials', body: { materials: [{ material_id: VALID_UUID, quantity: 1 }] }, invalidBody: {}, invalidPath: '/deduct/bad-uuid', failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'fleet.routes',
    routeModulePath: 'src/api/routes/fleet.routes.js',
    basePath: '/api/fleet',
    controllerModules: [{ modulePath: 'src/domains/fleet/vehicle.controller.js', handlers: ['getAllVehicles', 'getMaintenanceAlerts', 'getAllRepairs', 'getMetrics', 'getVehicleById', 'createVehicle', 'updateVehicle', 'updateMileage', 'deleteVehicle', 'logRepair', 'getRepairHistory'] }],
    routes: [
      { method: 'get', path: '/', handler: 'getAllVehicles', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/maintenance-alerts', handler: 'getMaintenanceAlerts', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/repairs', handler: 'getAllRepairs', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/metrics', handler: 'getMetrics', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}`, handler: 'getVehicleById', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: '/', handler: 'createVehicle', body: { business_id: BUSINESS_ID, make_model: 'Ford Transit' }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth' },
      { method: 'patch', path: `/${VALID_UUID}`, handler: 'updateVehicle', body: { make_model: 'Updated Van' }, invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'patch', path: `/${VALID_UUID}/mileage`, handler: 'updateMileage', body: { mileage: 120000 }, invalidBody: {}, invalidPath: '/bad-uuid/mileage', failureAuth: 'requireAuth' },
      { method: 'delete', path: `/${VALID_UUID}`, handler: 'deleteVehicle', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'staff.routes',
    routeModulePath: 'src/api/routes/staff.routes.js',
    basePath: '/api/staff',
    controllerModules: [{ modulePath: 'src/domains/team/staff.controller.js', handlers: ['getAllStaff', 'getAvailableStaff', 'getDashboardSummary', 'timeTracking', 'updateAvailability', 'getStaffMetrics', 'calculatePayroll', 'getTimesheets', 'getStaffTimesheets', 'getStaffPayroll', 'getStaffById', 'createStaff', 'updateStaff', 'deleteStaff', 'clockIn', 'clockOut'] }],
    routes: [
      { method: 'get', path: '/', handler: 'getAllStaff', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/available', handler: 'getAvailableStaff', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/dashboard/summary', handler: 'getDashboardSummary', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'post', path: '/time-tracking', handler: 'timeTracking', body: { action: 'Clock In' }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'post', path: '/availability', handler: 'updateAvailability', body: { schedule: { monday: { available: true, start: '09:00', end: '17:00' } } }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/metrics', handler: 'getStaffMetrics', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/payroll', handler: 'calculatePayroll', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/timesheets', handler: 'getTimesheets', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}`, handler: 'getStaffById', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: '/', handler: 'createStaff', body: { business_id: BUSINESS_ID, name: 'Taylor', hourly_rate: 25, email: 'taylor@example.com' }, invalidBody: { business_id: BUSINESS_ID, name: 'Taylor', hourly_rate: 25 }, failureAuth: 'requireAuth' },
      { method: 'patch', path: `/${VALID_UUID}`, handler: 'updateStaff', body: { name: 'Updated staff' }, invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'delete', path: `/${VALID_UUID}`, handler: 'deleteStaff', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/clock-in`, handler: 'clockIn', invalidPath: '/bad-uuid/clock-in', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/clock-out`, handler: 'clockOut', invalidPath: '/bad-uuid/clock-out', failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}/timesheets`, handler: 'getStaffTimesheets', invalidPath: '/bad-uuid/timesheets', failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}/payroll`, handler: 'getStaffPayroll', invalidPath: '/bad-uuid/payroll', failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'pricebook.routes',
    routeModulePath: 'src/api/routes/pricebook.routes.js',
    basePath: '/api/price-book',
    controllerModules: [{ modulePath: 'src/domains/pricebook/pricebook.controller.js', handlers: ['getCategories', 'createCategory', 'updateCategory', 'deleteCategory', 'getItems', 'getSuggestions', 'getItemById', 'createItem', 'updateItemByBodyId', 'updateItem', 'deleteItem'] }],
    routes: [
      { method: 'get', path: '/categories', handler: 'getCategories', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'post', path: '/categories', handler: 'createCategory', body: { business_id: BUSINESS_ID, name: 'Plumbing' }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth' },
      { method: 'patch', path: `/categories/${VALID_UUID}`, handler: 'updateCategory', body: { name: 'Updated category' }, invalidPath: '/categories/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'delete', path: `/categories/${VALID_UUID}`, handler: 'deleteCategory', invalidPath: '/categories/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'get', path: '/', handler: 'getItems', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/suggestions', handler: 'getSuggestions', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}`, handler: 'getItemById', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: '/', handler: 'createItem', body: { business_id: BUSINESS_ID, name: 'Service item' }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth' },
      { method: 'patch', path: '/', handler: 'updateItemByBodyId', body: { id: VALID_UUID, business_id: BUSINESS_ID, name: 'Updated by body id' }, invalidBody: { business_id: BUSINESS_ID, name: 'Updated by body id' }, failureAuth: 'requireAuth' },
      { method: 'patch', path: `/${VALID_UUID}`, handler: 'updateItem', body: { name: 'Updated item' }, invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'delete', path: `/${VALID_UUID}`, handler: 'deleteItem', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'dashboard.routes',
    routeModulePath: 'src/api/routes/dashboard.routes.js',
    basePath: '/api/dashboard',
    controllerModules: [{ modulePath: 'src/domains/dashboard/dashboard.controller.js', handlers: ['getSummary', 'getWeeklyReport', 'getRevenueChart', 'getJobsAnalytics'] }],
    routes: [
      { method: 'get', path: '/summary', handler: 'getSummary', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/weekly-report', handler: 'getWeeklyReport', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/revenue', handler: 'getRevenueChart', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/jobs-analytics', handler: 'getJobsAnalytics', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'follow_ups.routes',
    routeModulePath: 'src/api/routes/follow_ups.routes.js',
    basePath: '/api/follow-ups',
    controllerModules: [{ modulePath: 'src/domains/follow_ups/follow_up.controller.js', handlers: ['list', 'show', 'create', 'update', 'markSent', 'cancel', 'remove'] }],
    routes: [
      { method: 'get', path: '/', handler: 'list', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}`, handler: 'show', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: '/', handler: 'create', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'patch', path: `/${VALID_UUID}`, handler: 'update', body: { status: 'Sent' }, invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/sent`, handler: 'markSent', invalidPath: '/bad-uuid/sent', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/cancel`, handler: 'cancel', invalidPath: '/bad-uuid/cancel', failureAuth: 'requireAuth' },
      { method: 'delete', path: `/${VALID_UUID}`, handler: 'remove', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'team_checkins.routes',
    routeModulePath: 'src/api/routes/team_checkins.routes.js',
    basePath: '/api/team-checkins',
    controllerModules: [{ modulePath: 'src/domains/team_checkins/team_checkin.controller.js', handlers: ['list', 'show', 'create', 'update', 'receive', 'escalate', 'remove'] }],
    routes: [
      { method: 'get', path: '/', handler: 'list', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}`, handler: 'show', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: '/', handler: 'create', body: { staff_id: VALID_UUID, scheduled_at: '2026-04-05T10:00:00.000Z' }, invalidBody: { staff_id: VALID_UUID }, failureAuth: 'requireAuth' },
      { method: 'patch', path: `/${VALID_UUID}`, handler: 'update', body: { status: 'Received' }, invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/receive`, handler: 'receive', invalidPath: '/bad-uuid/receive', failureAuth: 'requireAuth' },
      { method: 'post', path: `/${VALID_UUID}/escalate`, handler: 'escalate', invalidPath: '/bad-uuid/escalate', failureAuth: 'requireAuth' },
      { method: 'delete', path: `/${VALID_UUID}`, handler: 'remove', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'bookkeeping.routes',
    routeModulePath: 'src/api/routes/bookkeeping.routes.js',
    basePath: '/api/bookkeeping',
    extraMocks: [
      {
        modulePath: 'multer',
        factory: () => {
          const middlewareFactory = () => ({
            single: () => (req, _res, next) => {
              req.file = req.file || {
                filename: 'receipt.jpg',
                originalname: 'acme-fuel-42.50.jpg',
              };
              next();
            },
          });
          middlewareFactory.diskStorage = jest.fn(() => ({}));
          return middlewareFactory;
        },
      },
    ],
    controllerModules: [
      { modulePath: 'src/domains/bookkeeping/bank_transaction.controller.js', handlers: ['list', 'summary', 'show', 'create', 'bulkCreate', 'importTransactions', 'update', 'categorize', 'remove'], label: 'transactions' },
      { modulePath: 'src/domains/bookkeeping/categorization_rule.controller.js', handlers: ['list', 'show', 'create', 'update', 'remove'], label: 'rules' },
      { modulePath: 'src/domains/bookkeeping/receipt_ocr.controller.js', handlers: ['processReceipt'], label: 'receipt-ocr' },
    ],
    routes: [
      { method: 'get', path: '/transactions', handler: 'list', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/bank_transaction.controller.js' },
      { method: 'get', path: '/transactions/summary', handler: 'summary', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/bank_transaction.controller.js' },
      { method: 'get', path: `/transactions/${VALID_UUID}`, handler: 'show', invalidPath: '/transactions/bad-uuid', failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/bank_transaction.controller.js' },
      { method: 'post', path: '/transactions', handler: 'create', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/bank_transaction.controller.js' },
      { method: 'post', path: '/transactions/bulk', handler: 'bulkCreate', body: { business_id: BUSINESS_ID, transactions: [] }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/bank_transaction.controller.js' },
      { method: 'post', path: '/transactions/import', handler: 'importTransactions', body: { business_id: BUSINESS_ID, file_url: 'https://example.com/tx.csv' }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/bank_transaction.controller.js' },
      { method: 'patch', path: `/transactions/${VALID_UUID}`, handler: 'update', body: { amount: 100 }, invalidPath: '/transactions/bad-uuid', failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/bank_transaction.controller.js' },
      { method: 'patch', path: `/transactions/${VALID_UUID}/categorize`, handler: 'categorize', body: { category: 'Office' }, invalidPath: '/transactions/bad-uuid/categorize', failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/bank_transaction.controller.js' },
      { method: 'delete', path: `/transactions/${VALID_UUID}`, handler: 'remove', invalidPath: '/transactions/bad-uuid', failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/bank_transaction.controller.js' },
      { method: 'post', path: '/receipt-ocr', handler: 'processReceipt', body: { business_id: BUSINESS_ID, file_url: 'https://example.com/receipt.jpg' }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/receipt_ocr.controller.js' },
      { method: 'get', path: '/rules', handler: 'list', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/categorization_rule.controller.js' },
      { method: 'get', path: `/rules/${VALID_UUID}`, handler: 'show', invalidPath: '/rules/bad-uuid', failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/categorization_rule.controller.js' },
      { method: 'post', path: '/rules', handler: 'create', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/categorization_rule.controller.js' },
      { method: 'patch', path: `/rules/${VALID_UUID}`, handler: 'update', body: { name: 'Rule' }, invalidPath: '/rules/bad-uuid', failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/categorization_rule.controller.js' },
      { method: 'delete', path: `/rules/${VALID_UUID}`, handler: 'remove', invalidPath: '/rules/bad-uuid', failureAuth: 'requireAuth', modulePath: 'src/domains/bookkeeping/categorization_rule.controller.js' },
    ],
  },
  {
    name: 'integrations.routes',
    routeModulePath: 'src/api/routes/integrations.routes.js',
    basePath: '/api/integrations',
    controllerModules: [{ modulePath: 'src/domains/integrations/integrations.controller.js', handlers: ['getStripeConnectUrl', 'getPlaidLinkToken', 'syncQuickBooks'] }],
    routes: [
      { method: 'get', path: '/stripe/connect-url', handler: 'getStripeConnectUrl', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/plaid/link-token', handler: 'getPlaidLinkToken', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'post', path: '/quickbooks/sync', handler: 'syncQuickBooks', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'subscriptions.routes',
    routeModulePath: 'src/api/routes/subscriptions.routes.js',
    basePath: '/api/subscriptions',
    controllerModules: [{ modulePath: 'src/domains/subscriptions/subscription.controller.js', handlers: ['getStatus', 'start', 'createSetupIntent', 'savePaymentMethod', 'cancel', 'resume'] }],
    routes: [
      { method: 'get', path: '/status', handler: 'getStatus', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'post', path: '/setup-intent', handler: 'createSetupIntent', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'post', path: '/payment-method', handler: 'savePaymentMethod', body: { business_id: BUSINESS_ID, payment_method_id: 'pm_123' }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth' },
      { method: 'post', path: '/start', handler: 'start', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'post', path: '/cancel', handler: 'cancel', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'post', path: '/resume', handler: 'resume', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'webhooks.routes',
    routeModulePath: 'src/api/routes/webhooks.routes.js',
    basePath: '/api/webhooks',
    controllerModules: [{ modulePath: 'src/domains/webhooks/stripe_webhook.controller.js', handlers: ['handleStripeWebhook'] }],
    routes: [
      { method: 'post', path: '/stripe', handler: 'handleStripeWebhook', body: { id: 'evt_123', type: 'customer.subscription.updated' }, skipFailure: true },
    ],
  },
  {
    name: 'ai_logs.routes',
    routeModulePath: 'src/api/routes/ai_logs.routes.js',
    basePath: '/api/ai-logs',
    controllerModules: [{ modulePath: 'src/domains/ai_logs/ai_event_log.controller.js', handlers: ['list', 'eventTypes', 'show', 'create'] }],
    routes: [
      { method: 'get', path: '/', handler: 'list', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/event-types', handler: 'eventTypes', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}`, handler: 'show', failureAuth: 'requireAuth' },
      { method: 'post', path: '/', handler: 'create', body: { business_id: BUSINESS_ID, event_type: 'call.missed' }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'ai.routes',
    routeModulePath: 'src/api/routes/ai.routes.js',
    basePath: '/api/ai',
    controllerModules: [
      { modulePath: 'src/domains/business/business.controller.js', handlers: ['getAiStatus', 'toggleAiStatus'] },
      { modulePath: 'src/domains/ai/ai_chat.controller.js', handlers: ['chat'] },
    ],
    routes: [
      { method: 'get', path: '/status', handler: 'getAiStatus', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth', modulePath: 'src/domains/business/business.controller.js' },
      { method: 'post', path: '/toggle-status', handler: 'toggleAiStatus', body: { business_id: BUSINESS_ID, status: 'paused' }, invalidBody: { business_id: BUSINESS_ID }, failureAuth: 'requireAuth', modulePath: 'src/domains/business/business.controller.js' },
      { method: 'post', path: '/chat', handler: 'chat', body: { business_id: BUSINESS_ID, message: 'Hello', history: [] }, invalidBody: { business_id: BUSINESS_ID, message: 'Hello' }, failureAuth: 'requireAuth', modulePath: 'src/domains/ai/ai_chat.controller.js' },
    ],
  },
  {
    name: 'businesses.routes',
    routeModulePath: 'src/api/routes/businesses.routes.js',
    basePath: '/api/businesses',
    controllerModules: [{ modulePath: 'src/domains/business/business.controller.js', handlers: ['getDashboardSummary'] }],
    routes: [
      { method: 'get', path: `/${VALID_UUID}`, handler: 'getDashboardSummary', invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'business.routes',
    routeModulePath: 'src/api/routes/business.routes.js',
    basePath: '/api/business',
    controllerModules: [{ modulePath: 'src/domains/business/business.controller.js', handlers: ['getDashboardSummary', 'getAiStatus', 'toggleAiStatus', 'getProfile', 'updateProfile', 'getAlerts', 'updateAlerts', 'getAutomation', 'updateAutomation', 'getCommunication', 'updateCommunication', 'getFinanceSettings', 'updateFinanceSettings', 'getFinanceSettingsById', 'updateFinanceSettingsById'] }],
    routes: [
      { method: 'get', path: '/profile', handler: 'getProfile', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'patch', path: '/profile', handler: 'updateProfile', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/alerts', handler: 'getAlerts', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'patch', path: '/alerts', handler: 'updateAlerts', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/automation', handler: 'getAutomation', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'patch', path: '/automation', handler: 'updateAutomation', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/communication', handler: 'getCommunication', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'patch', path: '/communication', handler: 'updateCommunication', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: '/finance-settings', handler: 'getFinanceSettings', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'patch', path: '/finance-settings', handler: 'updateFinanceSettings', body: { business_id: BUSINESS_ID }, invalidBody: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}/finance-settings`, handler: 'getFinanceSettingsById', invalidPath: '/bad-uuid/finance-settings', failureAuth: 'requireAuth' },
      { method: 'patch', path: `/${VALID_UUID}/finance-settings`, handler: 'updateFinanceSettingsById', body: { company_info: { name: 'Ajicore' } }, invalidPath: '/bad-uuid/finance-settings', failureAuth: 'requireAuth' },
    ],
  },
  {
    name: 'conversations.routes',
    routeModulePath: 'src/api/routes/conversations.routes.js',
    basePath: '/api/conversations',
    controllerModules: [{ modulePath: 'src/domains/conversations/conversation.controller.js', handlers: ['list', 'show', 'startInternal', 'finalizeInternal', 'appendInternal'] }],
    routes: [
      { method: 'get', path: '/', handler: 'list', query: { business_id: BUSINESS_ID }, invalidQuery: {}, failureAuth: 'requireAuth' },
      { method: 'get', path: `/${VALID_UUID}`, handler: 'show', query: { business_id: BUSINESS_ID }, invalidQuery: {}, invalidPath: '/bad-uuid', failureAuth: 'requireAuth' },
    ],
  },
];

function getHandlersForRoute(harness, moduleConfig, routeConfig) {
  const modulePath = routeConfig.modulePath || moduleConfig.controllerModules[0].modulePath;
  return harness.controllerHandlers[modulePath];
}

describe('standard API route modules', () => {
  describe.each(standardModules)('$name', (moduleConfig) => {
    let harness;

    beforeAll(async () => {
      harness = createRouteHarness(moduleConfig);
      await harness.start();
    });

    afterAll(async () => {
      await harness.stop();
    });

    test.each(moduleConfig.routes)('$method $path success', async (routeConfig) => {
      harness.authState.fail = null;

      const response = await harness.request({
        method: routeConfig.method.toUpperCase(),
        path: `${moduleConfig.basePath}${routeConfig.path}`,
        query: routeConfig.query,
        body: routeConfig.body,
      });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(getHandlersForRoute(harness, moduleConfig, routeConfig)[routeConfig.handler]).toHaveBeenCalledTimes(1);
    });

    test.each(moduleConfig.routes)('$method $path failure', async (routeConfig) => {
      if (routeConfig.skipFailure) {
        return;
      }
      harness.authState.fail = null;

      const response = await harness.request({
        method: routeConfig.method.toUpperCase(),
        path: `${moduleConfig.basePath}${routeConfig.invalidPath || routeConfig.path}`,
        query: routeConfig.invalidQuery !== undefined ? routeConfig.invalidQuery : routeConfig.query,
        body: routeConfig.invalidBody !== undefined ? routeConfig.invalidBody : routeConfig.body,
      });

      if (routeConfig.invalidPath || routeConfig.invalidBody !== undefined || routeConfig.invalidQuery !== undefined) {
        expect(response.status).toBe(400);
      } else {
        harness.authState.fail = routeConfig.failureAuth || '*';
        harness.authState.status = 401;
        const authFailure = await harness.request({
          method: routeConfig.method.toUpperCase(),
          path: `${moduleConfig.basePath}${routeConfig.path}`,
          query: routeConfig.query,
          body: routeConfig.body,
        });
        expect(authFailure.status).toBe(401);
      }
    });
  });
});

describe('app-level endpoints', () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = require(abs('src/app.js'));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /api/health returns service metadata', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('ok');
    expect(payload.service).toBe('ajicore');
  });

  test('GET /api/docs.json returns swagger paths', async () => {
    const response = await fetch(`${baseUrl}/api/docs.json`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.paths['/api/auth/signin']).toBeDefined();
    expect(payload.paths['/api/billing/stripe-config']).toBeDefined();
    expect(payload.paths['/api/subscriptions/start']).toBeDefined();
    expect(payload.paths['/api/webhooks/stripe']).toBeDefined();
    expect(payload.paths['/api/internal/ai/business-by-phone']).toBeDefined();
    expect(payload.components.schemas.AuthSignupInput.properties.email.format).toBe('email');
    expect(payload.components.schemas.AuthSignupInput.properties.password.minLength).toBe(8);
    expect(payload.components.schemas.AuthSignupInput.properties.password.writeOnly).toBe(true);
    expect(payload.components.schemas.AuthSignupInput.properties.password.description).toContain('No uppercase');
    expect(payload.components.schemas.AuthSigninInput.properties.email.description).toContain('signup');
    expect(payload.components.schemas.AuthSigninInput.properties.password.minLength).toBe(1);
    expect(payload.components.schemas.AuthSigninInput.properties.password.description).toContain('exact password');
    expect(payload.components.schemas.StripeConfigResponse.properties.publishable_key).toBeDefined();
    expect(payload.components.schemas.SubscriptionStatusResponse.properties.subscription).toBeDefined();
    expect(payload.components.schemas.Customer.properties.display_name).toBeDefined();
  });

  test('GET /api/reference returns Scalar HTML', async () => {
    const response = await fetch(`${baseUrl}/api/reference`);
    const payload = await response.text();

    expect(response.status).toBe(200);
    expect(payload).toContain('@scalar/api-reference');
    expect(payload).toContain('/api/docs.json');
  });

  test('unknown route returns not found payload', async () => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`);
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('Not Found');
  });
});

describe('production proxy behavior', () => {
  const originalEnv = { ...process.env };
  let server;
  let baseUrl;

  beforeAll(async () => {
    jest.resetModules();
    Object.assign(process.env, {
      ...originalEnv,
      NODE_ENV: 'production',
      PORT: '3000',
      JWT_SECRET: originalEnv.JWT_SECRET || 'test-jwt-secret',
      DATABASE_URL: originalEnv.DATABASE_URL || 'postgresql://user:pass@localhost:5432/ajicore',
      STRIPE_SECRET_KEY: originalEnv.STRIPE_SECRET_KEY || 'sk_test_123',
      INTERNAL_API_KEY: originalEnv.INTERNAL_API_KEY || 'internal-test-key',
      TWILIO_ACCOUNT_SID: originalEnv.TWILIO_ACCOUNT_SID || 'test-twilio-account-sid',
      TWILIO_AUTH_TOKEN: originalEnv.TWILIO_AUTH_TOKEN || 'twilio-auth-token',
      TWILIO_PHONE_NUMBER: originalEnv.TWILIO_PHONE_NUMBER || '+15555550123',
      MAIL_PROVIDER: originalEnv.MAIL_PROVIDER || 'smtp',
      SMTP_HOST: originalEnv.SMTP_HOST || 'smtp.example.com',
      SMTP_PORT: originalEnv.SMTP_PORT || '587',
      SMTP_USER: originalEnv.SMTP_USER || 'smtp-user',
      SMTP_PASS: originalEnv.SMTP_PASS || 'smtp-pass',
      MAIL_FROM_EMAIL: originalEnv.MAIL_FROM_EMAIL || 'support@example.com',
      ALLOWED_ORIGINS: 'https://myajicore.com',
    });

    const app = require(abs('src/app.js'));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    process.env = originalEnv;
    jest.resetModules();
  });

  test('GET /api/health is not redirected for localhost probes in production', async () => {
    const response = await fetch(`${baseUrl}/api/health`, { redirect: 'manual' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(payload.status).toBe('ok');
  });

  test('OPTIONS /api/auth/google returns CORS headers for allowed origin in production', async () => {
    const response = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://myajicore.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://myajicore.com');
    expect(response.headers.get('access-control-allow-methods')).toContain('OPTIONS');
  });
});
