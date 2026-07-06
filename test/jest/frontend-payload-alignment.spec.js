jest.mock('../../src/lib/prisma', () => ({
  quote: {
    count: jest.fn(),
  },
  bookkeepingTransaction: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  bankTransaction: {
    findUnique: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  businessFinanceSettings: {
    findUnique: jest.fn(),
  },
  serviceCategory: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  priceBookItem: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
}));

const prisma = require('../../src/lib/prisma');
const quoteService = require('../../src/domains/quotes/quote.service');
const bookkeepingService = require('../../src/domains/bookkeeping/bank_transaction.service');
const pricebookService = require('../../src/domains/pricebook/pricebook.service');

describe('frontend payload alignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test('quote scheduling accepts 24-hour HH:MM appointment time', () => {
    const result = quoteService.parseEstimateWindow('2026-05-15T00:00:00.000Z', '14:30');

    expect(result.start.toISOString()).toBe('2026-05-15T14:30:00.000Z');
    expect(result.end).toBeNull();
  });

  test('receipt OCR flow creates an uncategorized transaction from a file URL', async () => {
    prisma.bookkeepingTransaction.create.mockResolvedValue({
      id: 'tx-1',
      vendor: 'receipt-home depot',
      amount: 150.75,
      category: null,
      source: 'ocr',
      receipt_url: 'https://storage.example.com/receipt-home-depot-150_75.jpg',
    });

    const result = await bookkeepingService.createReceiptTransactionFromUrl({
      business_id: 'business-1',
      file_url: 'https://storage.example.com/receipt-home-depot-150_75.jpg',
    });

    expect(prisma.bookkeepingTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        business_id: 'business-1',
        category: null,
        source: 'ocr',
        receipt_url: 'https://storage.example.com/receipt-home-depot-150_75.jpg',
      }),
    }));
    expect(result.extracted_data.amount).toBe(150.75);
    expect(result.transaction.category).toBeNull();
  });

  test('spreadsheet import persists uncategorized bookkeeping transactions from file_url', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/csv' },
      arrayBuffer: async () => Buffer.from('vendor,amount,date,category\nHome Depot,150.75,2026-05-01T00:00:00.000Z,Materials'),
    });
    prisma.bookkeepingTransaction.createMany.mockResolvedValue({ count: 1 });

    const result = await bookkeepingService.importTransactionsFromFileUrl({
      business_id: 'business-1',
      file_url: 'https://storage.example.com/transactions.csv',
    });

    expect(prisma.bookkeepingTransaction.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          business_id: 'business-1',
          vendor: 'Home Depot',
          amount: 150.75,
          category: null,
          source: 'import',
        }),
      ],
    }));
    expect(result.count).toBe(1);
  });

  test('price book phone-quote services return a null visit_type and preserve service_cost', async () => {
    prisma.businessFinanceSettings.findUnique.mockResolvedValue({ markup_percent: 49 });
    prisma.priceBookItem.create.mockResolvedValue({
      id: 'item-1',
      can_quote_phone: true,
      visit_type: 'FreeEstimate',
      service_cost: 150,
      service_call_fee: 0,
      category: null,
    });

    const result = await pricebookService.createPriceBookItem({
      business_id: 'business-1',
      name: 'Standard Drain Cleaning',
      can_quote_phone: true,
      service_cost: 150,
      service_call_fee: 0,
      labor_cost: 50,
      materials: [],
      tools: [],
    });

    expect(result.visit_type).toBeNull();
    expect(result.service_cost).toBe(150);
    expect(result.service_call_fee).toBe(0);
  });

  test('bookkeeping categorization-only update works for ledger transactions', async () => {
    prisma.bankTransaction.findUnique.mockResolvedValue(null);
    prisma.bookkeepingTransaction.findUnique
      .mockResolvedValueOnce({
        id: 'ledger-1',
        business_id: 'business-1',
        transaction_date: new Date('2026-05-01T00:00:00.000Z'),
        vendor: 'Home Depot',
        amount: 150.75,
        category: null,
        source: 'manual',
        is_income: false,
        raw_description: 'Home Depot',
        receipt_url: 'https://storage.myajicore.com/uploads/receipt.png',
        notes: null,
        tags: [],
      })
      .mockResolvedValueOnce({
        id: 'ledger-1',
        business_id: 'business-1',
        transaction_date: new Date('2026-05-01T00:00:00.000Z'),
        vendor: 'Home Depot',
        amount: 150.75,
        category: 'Fleet Management',
        source: 'manual',
        is_income: false,
        raw_description: 'Home Depot',
        receipt_url: 'https://storage.myajicore.com/uploads/receipt.png',
        notes: 'Routine oil change for Truck 2.',
        tags: [{ name: 'Fleet', color: '#F59E0B' }],
      });
    prisma.bookkeepingTransaction.update.mockResolvedValue({ id: 'ledger-1' });

    const result = await bookkeepingService.update('ledger-1', {
      category: 'Fleet Management',
      notes: 'Routine oil change for Truck 2.',
      tags: [{ name: 'Fleet', color: '#F59E0B' }],
    });

    expect(prisma.bookkeepingTransaction.update).toHaveBeenCalledWith({
      where: { id: 'ledger-1' },
      data: expect.objectContaining({
        category: 'Fleet Management',
        notes: 'Routine oil change for Truck 2.',
        tags: [{ name: 'Fleet', color: '#F59E0B' }],
      }),
    });
    expect(result).toEqual(expect.objectContaining({
      id: 'ledger-1',
      category: 'Fleet Management',
      notes: 'Routine oil change for Truck 2.',
      tags: [{ name: 'Fleet', color: '#F59E0B' }],
    }));
  });
});
