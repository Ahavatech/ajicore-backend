const mockPrisma = {
  business: {
    findUnique: jest.fn(),
  },
  user: {
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
const mockStripeInstance = {
  customers: {
    create: jest.fn(),
    update: jest.fn(),
    retrieve: jest.fn(),
  },
  paymentMethods: {
    attach: jest.fn(),
    retrieve: jest.fn(),
  },
  setupIntents: {
    create: jest.fn(),
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
};

jest.mock('stripe', () => jest.fn().mockImplementation(() => mockStripeInstance), { virtual: true });

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

    mockStripeInstance.customers.retrieve.mockResolvedValue({
      id: 'cus_default',
      deleted: false,
      invoice_settings: {
        default_payment_method: null,
      },
    });
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

  test('createSetupIntent returns client secret and customer id', async () => {
    mockStripeInstance.customers.create.mockResolvedValue({ id: 'cus_123' });
    mockStripeInstance.setupIntents.create.mockResolvedValue({
      id: 'seti_123',
      client_secret: 'seti_secret_123',
    });

    mockPrisma.business.findUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Ajicore',
      company_email: 'owner@example.com',
      owner: { email: 'owner@example.com', phone_number: '+15555550123' },
    });
    mockPrisma.businessSubscription.findFirst.mockResolvedValue(null);

    const subscriptionService = require('../../src/domains/subscriptions/subscription.service');
    const result = await subscriptionService.createSetupIntent('biz-1');

    expect(result).toEqual({
      client_secret: 'seti_secret_123',
      setup_intent_id: 'seti_123',
      stripe_customer_id: 'cus_123',
    });
  });

  test('savePaymentMethod attaches and stores the default payment method', async () => {
    mockStripeInstance.customers.create.mockResolvedValue({ id: 'cus_123' });
    mockStripeInstance.paymentMethods.retrieve
      .mockResolvedValueOnce({
        id: 'pm_123',
        customer: null,
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
      })
      .mockResolvedValueOnce({
        id: 'pm_123',
        customer: 'cus_123',
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
      });
    mockStripeInstance.paymentMethods.attach.mockResolvedValue({ id: 'pm_123' });
    mockStripeInstance.customers.update.mockResolvedValue({ id: 'cus_123' });

    mockPrisma.business.findUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Ajicore',
      company_email: 'owner@example.com',
      owner: { email: 'owner@example.com', phone_number: '+15555550123' },
    });
    mockPrisma.businessSubscription.findFirst.mockResolvedValue(null);

    const subscriptionService = require('../../src/domains/subscriptions/subscription.service');
    const result = await subscriptionService.savePaymentMethod('biz-1', 'pm_123');

    expect(result).toEqual({
      success: true,
      stripe_customer_id: 'cus_123',
      payment_method: {
        id: 'pm_123',
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2030,
      },
    });
  });

  test('ensureTrialSubscriptionForBusiness uses the remaining user trial window', async () => {
    mockStripeInstance.customers.create.mockResolvedValue({ id: 'cus_123' });
    mockStripeInstance.prices.list.mockResolvedValue({ data: [] });
    mockStripeInstance.products.create.mockResolvedValue({ id: 'prod_123' });
    mockStripeInstance.prices.create.mockResolvedValue({ id: 'price_123' });
    mockStripeInstance.subscriptions.create.mockResolvedValue({
      id: 'sub_123',
      status: 'trialing',
      customer: 'cus_123',
      trial_start: Math.floor(Date.now() / 1000),
      trial_end: Math.floor((Date.now() + 10 * 24 * 60 * 60 * 1000) / 1000),
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor((Date.now() + 10 * 24 * 60 * 60 * 1000) / 1000),
      cancel_at_period_end: false,
      canceled_at: null,
      items: { data: [{ price: { id: 'price_123' } }] },
      latest_invoice: null,
      metadata: { business_id: 'biz-1', business_name: 'Ajicore' },
    });
    mockStripeInstance.customers.retrieve.mockResolvedValue({
      id: 'cus_123',
      invoice_settings: {
        default_payment_method: null,
      },
    });

    mockPrisma.business.findUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Ajicore',
      owner_id: 'user-1',
      company_email: 'owner@example.com',
      owner: { id: 'user-1', email: 'owner@example.com', phone_number: '+15555550123' },
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      trial_started_at: new Date(),
      trial_ends_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
    mockPrisma.businessSubscription.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockPrisma.businessSubscription.create.mockResolvedValue({
      id: 'local-sub-1',
      business_id: 'biz-1',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      stripe_price_id: 'price_123',
      status: 'trialing',
      trial_start: new Date(),
      trial_end: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      cancel_at_period_end: false,
      canceled_at: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const subscriptionService = require('../../src/domains/subscriptions/subscription.service');
    const result = await subscriptionService.ensureTrialSubscriptionForBusiness({
      userId: 'user-1',
      businessId: 'biz-1',
    });

    expect(mockStripeInstance.subscriptions.create).toHaveBeenCalledWith(expect.objectContaining({
      trial_end: expect.any(Number),
    }));
    expect(result.has_subscription).toBe(true);
    expect(result.subscription.status).toBe('trialing');
  });
});
