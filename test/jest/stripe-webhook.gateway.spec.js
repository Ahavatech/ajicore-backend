jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
}, { virtual: true });

describe('stripe webhook gateway', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  test('returns a clear configuration error when webhook secret is missing', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      DATABASE_URL: 'postgres://localhost:5432/test',
      STRIPE_SECRET_KEY: 'sk_test_secret',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_public',
      STRIPE_WEBHOOK_SECRET: '',
    };

    const gateway = require('../../src/integrations/payments/stripe_gateway');

    await expect(gateway.handleWebhook(Buffer.from('{}'), 'sig_test'))
      .rejects
      .toThrow('Stripe webhook secret is not configured on this server.');
  });
});
