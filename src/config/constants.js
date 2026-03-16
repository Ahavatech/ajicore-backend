/**
 * Application-wide constants.
 */
module.exports = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  JOB_STATUSES: ['Scheduled', 'InProgress', 'Completed', 'Invoiced', 'Cancelled'],
  JOB_TYPES: ['Job', 'ServiceCall'],
  JOB_SOURCES: ['AI', 'Manual', 'SMS'],

  QUOTE_STATUSES: ['EstimateScheduled', 'Draft', 'Sent', 'Approved', 'Declined', 'Expired'],

  INVOICE_STATUSES: ['Draft', 'Sent', 'PartiallyPaid', 'Paid', 'Overdue', 'Refunded', 'Voided', 'Cancelled'],
  INVOICE_EDIT_RULES: {
    Draft: 'full',
    Sent: 'full',
    PartiallyPaid: 'limited',
    Paid: 'notes_only',
    Overdue: 'full',
    Refunded: 'locked',
    Voided: 'locked',
    Cancelled: 'locked',
  },

  PRICE_TYPES: ['Fixed', 'Range', 'NeedsOnsite'],
  VISIT_TYPES: ['FreeEstimate', 'PaidServiceCall'],
  UNKNOWN_SERVICE_HANDLING: ['FreeEstimate', 'PaidServiceCall', 'TransferCall'],

  STAFF_ROLES: ['Owner', 'Manager', 'Technician', 'Apprentice', 'Admin'],

  EXPENSE_CATEGORIES: ['Materials', 'Labor', 'Equipment', 'Fuel', 'Insurance', 'Utilities', 'Marketing', 'Other'],

  DEFAULT_QUOTE_EXPIRY_DAYS: 30,

  CRON_SCHEDULES: {
    WEEKLY_REPORT: '0 8 * * 1',
    DAILY_REMINDERS: '0 7 * * *',
    INVENTORY_CHECK: '0 9 * * *',
    QUOTE_EXPIRY: '0 0 * * *',
  },
};
