jest.mock('../../src/lib/prisma', () => ({
  businessFinanceSettings: {
    findUnique: jest.fn(),
  },
  customer: {
    findFirst: jest.fn(),
  },
  invoice: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  invoiceLine: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  job: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  priceBookItem: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  quote: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  serviceCategory: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
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
const invoiceService = require('../../src/domains/billing/invoice.service');
const pricebookService = require('../../src/domains/pricebook/pricebook.service');
const quoteService = require('../../src/domains/quotes/quote.service');
const { calculateFinancials } = require('../../src/utils/financial_calculator');

describe('advanced frontend blueprint contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('financial calculator recalculates subtotal discount tax deposit and due amount', () => {
    const result = calculateFinancials({
      line_items: [{ description: 'Labor', quantity: 1, unit_price: 2500 }],
      discount_percent: 10,
      tax_percent: 5,
      deposit_percent: 50,
    });

    expect(result).toEqual(expect.objectContaining({
      subtotal: 2500,
      discount_amount: 250,
      tax_amount: 112.5,
      total_amount: 2362.5,
      deposit_amount: 1181.25,
      due_amount: 1181.25,
    }));
  });

  test('price book creates custom category and applies default 49 percent markup', async () => {
    prisma.serviceCategory.findFirst.mockResolvedValue(null);
    prisma.serviceCategory.create.mockResolvedValue({ id: 'cat-1' });
    prisma.businessFinanceSettings.findUnique.mockResolvedValue({ markup_percent: 49 });
    prisma.priceBookItem.create.mockResolvedValue({
      id: 'item-1',
      name: 'Drain Cleaning',
      category: { id: 'cat-1', name: 'General Maintenance' },
      labor_cost: 85,
      total_materials_cost: 15,
      total_tools_cost: 0,
      base_cost: 100,
      flat_rate: 149,
      margin_amount: 49,
      margin_percent: 33,
    });

    const result = await pricebookService.createPriceBookItem({
      business_id: 'business-1',
      name: 'Drain Cleaning',
      custom_category_name: 'General Maintenance',
      labor_cost: 85,
      materials: [{ name: 'PVC', qty: 1, rate: 15 }],
      tools: [],
    });

    expect(prisma.serviceCategory.create).toHaveBeenCalledWith({
      data: { business_id: 'business-1', name: 'General Maintenance' },
    });
    expect(prisma.priceBookItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        category_id: 'cat-1',
        base_cost: 100,
        flat_rate: 149,
        margin_amount: 49,
        margin_percent: 33,
      }),
    }));
    expect(result.category_name).toBe('General Maintenance');
  });

  test('quote send routes appointment quotes to Appointment and approval does not convert', async () => {
    prisma.quote.findUnique.mockResolvedValue({
      id: 'quote-1',
      business_id: 'business-1',
      customer_id: 'customer-1',
      assigned_staff_id: 'staff-1',
      is_estimate_appointment: true,
      business: { quote_expiry_days: 30 },
      customer: { first_name: 'Tim', last_name: 'Wilson' },
      assigned_staff: { name: 'John Smith' },
    });
    prisma.quote.update
      .mockResolvedValueOnce({
        id: 'quote-1',
        status: 'Appointment',
        customer: { first_name: 'Tim', last_name: 'Wilson' },
        assigned_staff: { name: 'John Smith' },
        createdAt: new Date('2026-04-28T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'quote-1',
        status: 'Approved',
        customer: { first_name: 'Tim', last_name: 'Wilson' },
        createdAt: new Date('2026-04-28T00:00:00.000Z'),
      });

    const sent = await quoteService.sendQuote('quote-1');
    const approved = await quoteService.approveQuote('quote-1');

    expect(sent.status).toBe('Appointment');
    expect(approved.status).toBe('Approved');
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  test('quote convert creates a job and returns job_id', async () => {
    prisma.quote.findUnique.mockResolvedValue({
      id: 'quote-1',
      business_id: 'business-1',
      customer_id: 'customer-1',
      assigned_staff_id: 'staff-1',
      service_name: 'Kitchen Remodel',
      description: 'Install sink',
      source: 'Manual',
      is_emergency: false,
      line_items: [{ description: 'Labor', total: 2500 }],
      customer: { location_main: '456 Oak Ave' },
    });
    prisma.$transaction.mockImplementation(async (cb) => cb({
      job: { create: jest.fn().mockResolvedValue({ id: 'job-1' }) },
      quote: { update: jest.fn().mockResolvedValue({ id: 'quote-1' }) },
    }));

    await expect(quoteService.convertToJob('quote-1')).resolves.toEqual({
      message: 'Converted successfully',
      job_id: 'job-1',
    });
  });

  test('customer billing and schedule return frontend shapes', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      {
        total_amount: 500,
        payments: [{ amount: 200 }],
        line_items: [],
      },
    ]);
    prisma.job.findMany.mockResolvedValue([
      {
        id: 'job-1',
        title: 'Kitchen Remodel',
        scheduled_start_time: new Date('2026-12-10T10:00:00.000Z'),
        assigned_staff: { name: 'Stack Joe' },
      },
    ]);
    prisma.quote.findMany.mockResolvedValue([
      {
        id: 'quote-1',
        service_name: 'Estimate Appointment',
        scheduled_start_time: new Date('2026-12-10T09:00:00.000Z'),
        assigned_staff: { name: 'Michael Stack' },
      },
    ]);

    await expect(customerService.getCustomerBilling('customer-1', 'business-1')).resolves.toEqual({ total_balance: 300 });
    const schedule = await customerService.getCustomerSchedule('customer-1', 'business-1');
    expect(schedule.data.map((item) => item.type)).toEqual(['Appointment', 'Job']);
  });

  test('invoice create supports direct customer invoices and recalculates totals', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'customer-1' });
    prisma.invoice.count.mockResolvedValue(0);
    prisma.invoice.create.mockResolvedValue({ id: 'invoice-1' });
    prisma.invoiceLine.createMany.mockResolvedValue({ count: 1 });
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      business_id: 'business-1',
      customer_id: 'customer-1',
      invoice_number: 'INV-0001',
      service_name: 'Electrical Upgrade',
      status: 'Draft',
      total_amount: 1282.5,
      line_items: [{ total: 1250, quantity: 1, unit_price: 1250 }],
      payments: [],
      customer: { first_name: 'Emily', last_name: 'Brown' },
      job: null,
      edit_logs: [],
    });

    const result = await invoiceService.create({
      business_id: 'business-1',
      customer_id: 'customer-1',
      service_name: 'Electrical Upgrade',
      line_items: [{ description: 'Labor', quantity: 1, unit_price: 1250 }],
      discount_percent: 5,
      tax_percent: 8,
      deposit_percent: 0,
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customer_id: 'customer-1',
        total_amount: 1282.5,
        due_amount: 1282.5,
      }),
    }));
    expect(result.customer_name).toBe('Emily Brown');
  });
});
