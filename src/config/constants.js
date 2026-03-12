/**
 * Application-wide constants.
 */
module.exports = {
  // Pagination defaults
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Job statuses
  JOB_STATUSES: ['Pending', 'Scheduled', 'InProgress', 'Completed', 'Cancelled'],

  // Document types
  DOCUMENT_TYPES: ['Quote', 'Invoice'],

  // Invoice statuses
  INVOICE_STATUSES: ['Draft', 'Sent', 'PartiallyPaid', 'Paid', 'Overdue', 'Cancelled'],

  // Staff roles
  STAFF_ROLES: ['Owner', 'Manager', 'Technician', 'Apprentice', 'Admin'],

  // Expense categories
  EXPENSE_CATEGORIES: [
    'Materials',
    'Labor',
    'Fuel',
    'Equipment',
    'Insurance',
    'Rent',
    'Utilities',
    'Marketing',
    'Miscellaneous',
  ],

  // Cron schedule expressions
  CRON_SCHEDULES: {
    WEEKLY_REPORT: '0 8 * * 1',       // Every Monday at 8 AM
    DAILY_REMINDERS: '0 7 * * *',     // Every day at 7 AM
    INVENTORY_CHECK: '0 9 * * *',     // Every day at 9 AM
  },
};