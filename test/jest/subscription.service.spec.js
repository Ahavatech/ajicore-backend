const mockPrisma = {
  business: {
    findUnique: jest.fn(),
  },
  businessSubscription: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  subscriptionPaymentEvent: {
    upsert: jest.fn(),
  },
};

jest.mock('../../src/lib/prisma', () => mockPrisma);
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('stripe', () => jest.fn().mockImplementation(() => ({
  customers: {
    create: jest.fn(),
    update: jest.fn(),
  },
  paymentMethods: {
    attach: jest.fn(),
  },
  prices: {
    list: jest.fn(),
    create: jest.fn(),
  },
  products: {
    create: jest.fn(),
  },
  subscriptions: {
    create: jest.fn(),
    update: jest.fn(),
    retrieve: jest.fn(),
  },
})), { virtual: true });

describe('subscription service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      DATABASE_URL: 'postgres://localhost:5432/test',
      STRIPE_SECRET_KEY: 'sk_test_secret',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_public',
      STRIPE_CURRENCY: 'usd',
      STRIPE_SUBSCRIPTION_PRICE_AMOUNT: '5000',
      STRIPE_SUBSCRIPTION_TRIAL_DAYS: '21',
      STRIPE_SUBSCRIPTION_PRODUCT_NAME: 'Ajicore Business Subscription',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('does not create a duplicate active subscription', async () => {
    const subscriptionService = require('../../src/domains/subscriptions/subscription.service');

    mockPrisma.business.findUnique.mockResolvedValue({ id: 'biz-1', name: 'Ajicore', company_email: 'owner@example.com' });
    mockPrisma.businessSubscription.findFirst.mockResolvedValue({
      id: 'sub-local-1',
      business_id: 'biz-1',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      stripe_price_id: 'price_123',
      status: 'active',
      trial_start: null,
      trial_end: null,
      current_period_start: new Date(),
      current_period_end: new Date(),
      cancel_at_period_end: false,
      canceled_at: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await subscriptionService.startSubscription('biz-1', {});

    expect(result.already_active).toBe(true);
    expect(result.subscription.stripe_subscription_id).toBe('sub_123');
  });
});
