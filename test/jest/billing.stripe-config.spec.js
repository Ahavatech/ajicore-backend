describe('billing stripe public config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  test('returns only publishable key and currency', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      DATABASE_URL: 'postgres://localhost:5432/test',
      STRIPE_SECRET_KEY: 'sk_test_secret',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_public',
      STRIPE_CURRENCY: 'usd',
    };

    const paymentService = require('../../src/domains/billing/payment.service');

    const result = paymentService.getPublicStripeConfig();

    expect(result).toEqual({
      publishable_key: 'pk_test_public',
      currency: 'usd',
    });
    expect(result.STRIPE_SECRET_KEY).toBeUndefined();
  });
});
