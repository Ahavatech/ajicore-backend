jest.mock('../../src/lib/prisma', () => ({
  customer: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  job: {
    count: jest.fn(),
    groupBy: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  payment: {
    aggregate: jest.fn(),
  },
  vehicle: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  fleetRepair: {
    aggregate: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  staff: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  notification: {
    count: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  invoice: {
    findMany: jest.fn(),
  },
  quote: {
    findMany: jest.fn(),
  },
  expense: {
    findMany: jest.fn(),
  },
  priceBookItem: {
    update: jest.fn(),
  },
}));

jest.mock('../../src/domains/ai_logs/activity_log.service', () => ({
  logActivitySafe: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const prisma = require('../../src/lib/prisma');
const customerService = require('../../src/domains/customers/customer.service');
const fleetService = require('../../src/domains/fleet/fleet.service');
const payrollService = require('../../src/domains/team/payroll.service');
const notificationService = require('../../src/domains/notifications/notification.service');
const jobService = require('../../src/domains/jobs/job.service');
const searchService = require('../../src/domains/search/search.service');
const reportsService = require('../../src/domains/reports/reports.service');

describe('frontend blueprint service contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('customer metrics returns the exact CRM KPI keys', async () => {
    prisma.customer.count.mockResolvedValue(2);
    prisma.job.count.mockResolvedValue(3);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 300 } });
    prisma.job.groupBy.mockResolvedValue([
      { customer_id: 'customer-1', _count: { _all: 2 } },
      { customer_id: 'customer-2', _count: { _all: 1 } },
    ]);

    const result = await customerService.getMetrics('business-1');

    expect(result).toEqual({
      total_customers: 2,
      total_jobs_across_all: 3,
      avg_customer_lifetime_value: 150,
      repeat_customer_percentage: 50,
    });
  });

  test('fleet repair logging and listing include the frontend date alias', async () => {
    const completionDate = new Date('2026-04-21T10:00:00.000Z');
    prisma.vehicle.findUnique.mockResolvedValue({ id: 'vehicle-1', business_id: 'business-1' });
    prisma.fleetRepair.create.mockResolvedValue({
      id: 'repair-1',
      vehicle_id: 'vehicle-1',
      business_id: 'business-1',
      description: 'Brake pads',
      cost: 120,
      completion_date: completionDate,
    });
    prisma.fleetRepair.findMany.mockResolvedValue([
      { id: 'repair-1', completion_date: completionDate },
    ]);
    prisma.fleetRepair.aggregate.mockResolvedValue({
      _sum: { cost: 120 },
      _count: { _all: 1 },
    });

    const created = await fleetService.logRepair('vehicle-1', {
      business_id: 'business-1',
      description: 'Brake pads',
      cost: 120,
      date: completionDate.toISOString(),
    }, 'user-1');
    const history = await fleetService.getRepairHistory('vehicle-1');
    const metrics = await fleetService.getMetrics('business-1');

    expect(created.date).toBe(completionDate);
    expect(history[0].date).toBe(completionDate);
    expect(metrics).toEqual({ totalRepairCosts: 120, avgRepairCost: 120 });
  });

  test('staff payroll returns current-cycle summary fields for one staff member', async () => {
    prisma.staff.findUnique.mockResolvedValue({
      id: 'staff-1',
      name: 'David Brown',
      role: 'Technician',
      hourly_rate: 25,
      timesheets: [
        { total_hours: 4, clock_in: new Date('2026-04-01T08:00:00.000Z'), clock_out: new Date('2026-04-01T12:00:00.000Z') },
        { total_hours: 2.5, clock_in: new Date('2026-04-02T08:00:00.000Z'), clock_out: new Date('2026-04-02T10:30:00.000Z') },
      ],
    });

    const result = await payrollService.calculateStaffPayroll(
      'staff-1',
      '2026-04-01T00:00:00.000Z',
      '2026-04-30T23:59:59.000Z'
    );

    expect(result).toEqual(expect.objectContaining({
      staff_id: 'staff-1',
      name: 'David Brown',
      hourly_rate: 25,
      total_hours: 6.5,
      timesheet_entries: 2,
      gross_pay: 162.5,
    }));
    expect(result.period).toEqual({
      start: '2026-04-01T00:00:00.000Z',
      end: '2026-04-30T23:59:59.000Z',
    });
  });

  test('notifications feed and read actions keep the frontend response contract', async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: 'notification-1', is_read: false }]);
    prisma.notification.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prisma.notification.update.mockResolvedValue({ id: 'notification-1', is_read: true });
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });

    await expect(notificationService.getNotifications({ business_id: 'business-1', limit: 50 }))
      .resolves.toEqual({
        data: [{ id: 'notification-1', is_read: false }],
        total: 1,
        unread_count: 1,
      });
    await expect(notificationService.markAsRead('notification-1'))
      .resolves.toEqual({ id: 'notification-1', is_read: true });
    await expect(notificationService.markAllAsRead('business-1'))
      .resolves.toEqual({ count: 3 });
  });

  test('jobs create response hydrates names, photo_urls, and line_items', async () => {
    prisma.job.create.mockResolvedValue({
      id: 'job-1',
      business_id: 'business-1',
      customer_id: 'customer-1',
      assigned_staff_id: 'staff-1',
      status: 'Scheduled',
      title: 'HVAC Repair',
      source: 'Manual',
      scheduled_start_time: new Date('2026-04-21T09:00:00.000Z'),
      photos_urls: ['https://example.com/photo.jpg'],
      line_items: [{ name: 'Diagnostic', price: 150, quantity: 1 }],
      customer: { first_name: 'Sarah', last_name: 'Johnson' },
      assigned_staff: { name: 'David Brown' },
    });

    const result = await jobService.createJob({
      business_id: 'business-1',
      customer_id: 'customer-1',
      assigned_staff_id: 'staff-1',
      title: 'HVAC Repair',
      photo_urls: ['https://example.com/photo.jpg'],
      line_items: [{ name: 'Diagnostic', price: 150, quantity: 1 }],
    });

    expect(prisma.job.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        photos_urls: ['https://example.com/photo.jpg'],
        line_items: [{ name: 'Diagnostic', price: 150, quantity: 1 }],
      }),
    }));
    expect(result).toEqual(expect.objectContaining({
      customer_name: 'Sarah Johnson',
      staff_name: 'David Brown',
      photo_urls: ['https://example.com/photo.jpg'],
      line_items: [{ name: 'Diagnostic', price: 150, quantity: 1 }],
    }));
  });

  test('jobs update accepts frontend photo_urls and line_items payload', async () => {
    prisma.job.update.mockResolvedValue({
      id: 'job-1',
      business_id: 'business-1',
      customer_id: 'customer-1',
      assigned_staff_id: null,
      status: 'Scheduled',
      title: 'Updated Job',
      source: 'Manual',
      photos_urls: ['https://example.com/new-photo.jpg'],
      line_items: [{ price_book_id: 'item-1', price: 200, quantity: 2 }],
      customer: { first_name: 'Sarah', last_name: 'Johnson' },
      assigned_staff: null,
    });

    const result = await jobService.updateJob('job-1', {
      photo_urls: ['https://example.com/new-photo.jpg'],
      line_items: [{ price_book_id: 'item-1', price: 200, quantity: 2 }],
    });

    expect(prisma.job.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        photos_urls: ['https://example.com/new-photo.jpg'],
        line_items: [{ price_book_id: 'item-1', price: 200, quantity: 2 }],
      }),
    }));
    expect(result).toEqual(expect.objectContaining({
      customer_name: 'Sarah Johnson',
      staff_name: null,
      photo_urls: ['https://example.com/new-photo.jpg'],
      line_items: [{ price_book_id: 'item-1', price: 200, quantity: 2 }],
    }));
  });

  test('global search maps all categories into generic frontend cards', async () => {
    prisma.customer.findMany.mockResolvedValue([
      { id: 'customer-1', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah@example.com', customer_type: 'Individual' },
    ]);
    prisma.job.findMany.mockResolvedValue([
      { id: 'job-1', title: 'HVAC Repair', scheduled_start_time: new Date('2026-10-12T09:00:00.000Z') },
    ]);
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'abcdef12-0000-4000-8000-000000000000', status: 'Sent', line_items: [{ total: 450 }] },
    ]);
    prisma.quote.findMany.mockResolvedValue([
      { id: 'quote-1', title: 'Plumbing Estimate', total_amount: 1200, status: 'Sent', customer: { first_name: 'Sarah', last_name: 'Johnson' } },
    ]);
    prisma.vehicle.findMany.mockResolvedValue([
      { id: 'vehicle-1', make_model: 'Ford F-150', license_plate: 'ABC-1234' },
    ]);

    const result = await searchService.globalSearch({ business_id: 'business-1', q: 'sarah' });

    expect(result.results.customers[0]).toEqual({ id: 'customer-1', title: 'Sarah Johnson', subtitle: 'sarah@example.com', type: 'customer' });
    expect(result.results.jobs[0]).toEqual({ id: 'job-1', title: 'HVAC Repair', subtitle: 'Scheduled for Oct 12', type: 'job' });
    expect(result.results.invoices[0]).toEqual({ id: 'abcdef12-0000-4000-8000-000000000000', title: 'INV-ABCDEF12', subtitle: '$450.00 - Unpaid', type: 'invoice' });
    expect(result.results.quotes[0]).toEqual({ id: 'quote-1', title: 'Plumbing Estimate', subtitle: '$1,200.00 - Pending', type: 'quote' });
    expect(result.results.fleet[0]).toEqual({ id: 'vehicle-1', title: 'Ford F-150', subtitle: 'License: ABC-1234', type: 'vehicle' });
  });

  test('reports financials returns 12 months with negative expenses and real breakdowns', async () => {
    prisma.job.findMany.mockResolvedValue([
      {
        service_type: 'plumbing',
        invoices: [{ payments: [{ amount: 500 }] }],
      },
    ]);
    prisma.expense.findMany.mockResolvedValue([
      { category: 'Fuel', amount: 100 },
    ]);

    const result = await reportsService.getFinancials({ business_id: 'business-1', year: 2026 });

    expect(result).toHaveLength(12);
    expect(result[0]).toEqual(expect.objectContaining({
      month: 'Jan',
      revenue: 500,
      expenses: -100,
      profit: 400,
    }));
    expect(result[0].breakdown.revenue.plumbing).toBe(500);
    expect(result[0].breakdown.jobsCount.plumbing).toBe(1);
    expect(result[0].breakdown.expensesList).toEqual([{ name: 'Fuel', amount: -100 }]);
  });

  test('reports KPI, top customers, and team performance use requested response shapes', async () => {
    prisma.job.findMany
      .mockResolvedValueOnce([
        { invoices: [{ payments: [{ amount: 300 }] }] },
        { invoices: [{ payments: [{ amount: 150 }] }] },
      ])
      .mockResolvedValueOnce([
        { invoices: [{ payments: [{ amount: 300 }] }] },
      ]);
    prisma.customer.findMany
      .mockResolvedValueOnce([{ id: 'new-customer' }])
      .mockResolvedValueOnce([
        {
          id: 'customer-1',
          first_name: 'Sarah',
          last_name: 'Johnson',
          company_name: 'Johnson HVAC',
          jobs: [
            { invoices: [{ payments: [{ amount: 6200 }] }] },
            { invoices: [{ payments: [] }] },
          ],
        },
      ]);
    prisma.customer.count.mockResolvedValue(2);
    prisma.staff.findMany.mockResolvedValue([
      {
        id: 'staff-1',
        name: 'David Brown',
        assigned_jobs: [
          {
            invoices: [{ payments: [{ amount: 18450 }] }],
            timesheets: [{ total_hours: 42 }],
          },
        ],
      },
    ]);

    const kpis = await reportsService.getKPIs({ business_id: 'business-1', timeframe: 'This Month' });
    const topCustomers = await reportsService.getTopCustomers({ business_id: 'business-1', year: 2026 });
    const teamPerformance = await reportsService.getTeamPerformance({ business_id: 'business-1', year: 2026 });

    expect(kpis).toEqual({
      revenue: 450,
      revenueTrend: 50,
      jobs: 2,
      jobsTrend: 100,
      newCustomers: 1,
      customersTrend: -50,
      avgJobValue: 225,
      avgJobValueTrend: -25,
    });
    expect(topCustomers[0]).toEqual({
      id: 'customer-1',
      name: 'Sarah Johnson',
      company: 'Johnson HVAC',
      revenue: 6200,
      jobsCount: 2,
    });
    expect(teamPerformance[0]).toEqual({
      id: 'staff-1',
      name: 'David Brown',
      revenue: 18450,
      jobsCompleted: 1,
      hoursWorked: 42,
    });
  });
});
