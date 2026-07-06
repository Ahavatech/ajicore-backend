jest.mock('../../src/lib/prisma', () => ({
  businessFinanceSettings: {
    upsert: jest.fn(),
    update: jest.fn(),
  },
  invoice: {
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    count: jest.fn(),
  },
  job: {
    updateMany: jest.fn(),
  },
  bookkeepingTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  invoiceEditLog: {
    create: jest.fn(),
  },
  bankTransaction: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  expense: {
    count: jest.fn(),
  },
  business: {
    findUnique: jest.fn(),
  },
}));

jest.mock('../../src/integrations/payments/stripe_gateway', () => ({
  isConfigured: jest.fn(() => false),
  createPaymentIntent: jest.fn(),
}));

jest.mock('../../src/domains/ai_logs/activity_log.service', () => ({
  logActivitySafe: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/domains/upload/upload.service', () => ({
  resolveUploadUrl: jest.fn().mockResolvedValue('http://localhost:3000/uploads/receipt.jpg'),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const prisma = require('../../src/lib/prisma');
const paymentService = require('../../src/domains/billing/payment.service');
const invoiceService = require('../../src/domains/billing/invoice.service');
const bankTransactionService = require('../../src/domains/bookkeeping/bank_transaction.service');
const receiptOcrService = require('../../src/domains/bookkeeping/receipt_ocr.service');
const integrationsService = require('../../src/domains/integrations/integrations.service');
const { generateInvoicePdf } = require('../../src/domains/billing/invoice_pdf.service');

function decodePdfHexText(buffer) {
  const matches = buffer.toString('latin1').match(/<([0-9A-Fa-f]+)>/g) || [];
  return matches
    .map((match) => Buffer.from(match.slice(1, -1), 'hex').toString('latin1'))
    .join(' ');
}

describe('financial modules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('record payment updates invoice and inserts bookkeeping ledger income', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      job_id: 'job-1',
      line_items: [{ total: 200, is_credit: false }],
      payments: [],
      job: {
        business_id: 'business-1',
        customer_id: 'customer-1',
        customer: { first_name: 'Sarah', last_name: 'Johnson' },
      },
    });
    prisma.payment.create.mockResolvedValue({
      id: 'payment-1',
      amount: 200,
      payment_method: 'manual',
      paid_at: new Date('2026-04-25T10:00:00.000Z'),
    });
    prisma.invoice.update.mockResolvedValue({
      id: 'invoice-1',
      status: 'Paid',
      line_items: [{ total: 200, is_credit: false }],
      payments: [{ amount: 200 }],
    });
    prisma.job.updateMany.mockResolvedValue({ count: 1 });
    prisma.bookkeepingTransaction.create.mockResolvedValue({ id: 'ledger-1' });

    const result = await paymentService.processPayment('invoice-1', {
      amount: 200,
      payment_method: 'manual',
    });

    expect(result.invoice.status).toBe('Paid');
    expect(prisma.bookkeepingTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        business_id: 'business-1',
        source: 'invoice',
        is_income: true,
        amount: 200,
        category: 'Job Income',
        reference_id: 'invoice-1',
      }),
    });
  });

  test('refund invoice inserts negative bookkeeping ledger entry', async () => {
    const refundedAt = new Date('2026-04-25T11:00:00.000Z');
    prisma.invoice.findUnique
      .mockResolvedValueOnce({
        id: 'invoice-1',
        status: 'Paid',
        payments: [{ amount: 200 }],
      })
      .mockResolvedValueOnce({
        id: 'invoice-1',
        business_id: 'business-1',
        job_id: 'job-1',
        refunded_at: refundedAt,
        job: {
          customer: { id: 'customer-1', first_name: 'Sarah', last_name: 'Johnson' },
          business: { name: 'Ajicore' },
        },
        line_items: [],
        payments: [],
        edit_logs: [],
      });
    prisma.invoice.update.mockResolvedValue({
      id: 'invoice-1',
      status: 'PartiallyPaid',
      refunded_at: refundedAt,
    });
    prisma.invoiceEditLog.create.mockResolvedValue({ id: 'edit-1' });
    prisma.bookkeepingTransaction.create.mockResolvedValue({ id: 'ledger-2' });

    const result = await invoiceService.refundInvoice('invoice-1', {
      amount: 50,
      reason: 'Partial refund',
      userId: 'user-1',
    });

    expect(result.status).toBe('PartiallyPaid');
    expect(prisma.bookkeepingTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        business_id: 'business-1',
        is_income: false,
        amount: -50,
        reference_id: 'invoice-1',
      }),
    });
  });

  test('bookkeeping transactions list merges bank and ledger entries', async () => {
    prisma.bankTransaction.findMany.mockResolvedValue([
      {
        id: 'bank-1',
        date: new Date('2026-04-25T09:00:00.000Z'),
        vendor: 'Fuel Station',
        amount: 100,
        is_income: false,
        category: 'Fuel',
        source: 'manual',
        receipt_url: 'http://example.com/receipt.jpg',
      },
    ]);
    prisma.bankTransaction.count.mockResolvedValue(1);
    prisma.bookkeepingTransaction.findMany.mockResolvedValue([
      {
        id: 'ledger-1',
        transaction_date: new Date('2026-04-25T10:00:00.000Z'),
        description: 'Payment recorded for invoice invoice-1',
        amount: 200,
        is_income: true,
        category: 'Job Income',
        source: 'invoice',
      },
    ]);
    prisma.bookkeepingTransaction.count.mockResolvedValue(1);

    const result = await bankTransactionService.getTransactions({
      business_id: 'business-1',
      limit: 10,
    });

    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual(expect.objectContaining({
      id: 'ledger-1',
      date: new Date('2026-04-25T10:00:00.000Z'),
      vendor: 'Payment recorded for invoice invoice-1',
      amount: 200,
      is_income: true,
    }));
    expect(result.total).toBe(2);
  });

  test('bookkeeping summary returns totalRevenue totalExpenses and netProfit', async () => {
    prisma.bankTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 300 }, _count: 1 })
      .mockResolvedValueOnce({ _sum: { amount: 80 }, _count: 1 });
    prisma.bookkeepingTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 200 }, _count: 1 })
      .mockResolvedValueOnce({ _sum: { amount: -20 }, _count: 1 });

    const result = await bankTransactionService.getSummary('business-1');

    expect(result).toEqual(expect.objectContaining({
      totalRevenue: 500,
      totalExpenses: 100,
      netProfit: 400,
    }));
  });

  test('receipt OCR returns uploaded url and filename-derived extraction', async () => {
    const result = await receiptOcrService.processReceipt(
      {
        business_id: 'business-1',
        file_url: 'https://storage.example.com/receipts/acme-fuel-42.50.jpg',
      }
    );

    expect(result).toEqual(expect.objectContaining({
      url: 'https://storage.example.com/receipts/acme-fuel-42.50.jpg',
      extracted_data: expect.objectContaining({
        amount: 42.5,
      }),
      transaction: expect.objectContaining({
        id: expect.any(String),
      }),
    }));
  });

  test('invoice pdf generator returns a styled PDF buffer', async () => {
    const buffer = await generateInvoicePdf({
      id: 'invoice-1',
      status: 'Sent',
      invoice_number: 'INV-0001',
      total_amount: 150,
      due_amount: 100,
      due_date: new Date('2026-04-30T00:00:00.000Z'),
      notes: 'Thanks for your business',
      line_items: [{ description: 'Service Call', quantity: 1, total: 150, is_credit: false }],
      payments: [{ amount: 50 }],
      business: {
        name: 'Ajicore',
        company_email: 'billing@ajicore.com',
        company_phone: '+1 555 222 1111',
      },
      customer: { first_name: 'Sarah', last_name: 'Johnson', location_main: '456 Oak Ave' },
      job: {
        business: { name: 'Ajicore' },
        customer: { first_name: 'Sarah', last_name: 'Johnson' },
      },
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString('utf8', 0, 8)).toContain('%PDF');
    const decodedText = decodePdfHexText(buffer);
    const compactText = decodedText.replace(/\s+/g, '');
    expect(compactText).toContain('Ajicore');
    expect(compactText).toContain('Invoice');
    expect(compactText).toContain('SarahJohnson');
    expect(compactText).toContain('INV-0001');
  });

  test('invoice pdf generator tolerates missing optional branding fields', async () => {
    await expect(generateInvoicePdf({
      id: 'invoice-2',
      status: 'Paid',
      line_items: [],
      payments: [],
      customer: { first_name: 'Taylor' },
      business: { name: 'Ajicore' },
    })).resolves.toBeInstanceOf(Buffer);
  });

  test('bookkeeping transaction update persists tags notes and category for bank-backed records', async () => {
    prisma.bankTransaction.findUnique
      .mockResolvedValueOnce({
        id: 'bank-1',
        business_id: 'business-1',
        date: new Date('2026-05-01T00:00:00.000Z'),
        vendor: 'Old Vendor',
        amount: 100,
        category: null,
        source: 'bank',
        is_income: false,
        raw_description: 'Old Vendor',
        receipt_url: null,
        notes: null,
        tags: [],
      })
      .mockResolvedValueOnce({
        id: 'bank-1',
        business_id: 'business-1',
        date: new Date('2026-05-01T00:00:00.000Z'),
        vendor: 'Home Depot',
        amount: 150.75,
        category: 'Materials & Supplies',
        source: 'manual',
        is_income: false,
        raw_description: 'Home Depot',
        receipt_url: 'https://storage.myajicore.com/uploads/receipt.png',
        notes: 'Bought extra PVC pipes for the Smith job.',
        tags: [{ name: 'Plumbing', color: '#3B82F6' }],
      });
    prisma.bankTransaction.update.mockResolvedValue({ id: 'bank-1' });

    const result = await bankTransactionService.update('bank-1', {
      vendor: 'Home Depot',
      amount: 150.75,
      date: '2026-05-01T00:00:00.000Z',
      category: 'Materials & Supplies',
      source: 'manual',
      is_income: false,
      raw_description: 'Home Depot',
      receipt_url: 'https://storage.myajicore.com/uploads/receipt.png',
      notes: 'Bought extra PVC pipes for the Smith job.',
      tags: [{ name: 'Plumbing', color: '#3B82F6' }],
    });

    expect(prisma.bankTransaction.update).toHaveBeenCalledWith({
      where: { id: 'bank-1' },
      data: expect.objectContaining({
        vendor: 'Home Depot',
        amount: 150.75,
        category: 'Materials & Supplies',
        source: 'manual',
        receipt_url: 'https://storage.myajicore.com/uploads/receipt.png',
        notes: 'Bought extra PVC pipes for the Smith job.',
        tags: [{ name: 'Plumbing', color: '#3B82F6' }],
      }),
    });
    expect(result).toEqual(expect.objectContaining({
      id: 'bank-1',
      vendor: 'Home Depot',
      category: 'Materials & Supplies',
      notes: 'Bought extra PVC pipes for the Smith job.',
      tags: [{ name: 'Plumbing', color: '#3B82F6' }],
    }));
  });

  test('integrations service returns plaid link token and quickbooks sync summary', async () => {
    prisma.invoice.count.mockResolvedValue(3);
    prisma.payment.count.mockResolvedValue(2);
    prisma.expense.count.mockResolvedValue(4);
    prisma.bookkeepingTransaction.count.mockResolvedValue(5);

    const plaid = await integrationsService.createPlaidLinkToken('business-1');
    const quickbooks = await integrationsService.syncQuickBooks('business-1');

    expect(plaid.link_token).toContain('plaid-link-business-1-');
    expect(quickbooks).toEqual(expect.objectContaining({
      business_id: 'business-1',
      status: 'queued',
      synced: {
        invoices: 3,
        payments: 2,
        expenses: 4,
        ledger_transactions: 5,
      },
    }));
  });
});
