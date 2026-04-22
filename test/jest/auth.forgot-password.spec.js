describe('forgot password production contract', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'test-secret',
      DATABASE_URL: 'postgres://localhost:5432/test',
      STRIPE_SECRET_KEY: 'sk_test',
      TWILIO_ACCOUNT_SID: 'ACtest',
      TWILIO_AUTH_TOKEN: 'twilio-token',
      INTERNAL_API_KEY: 'internal-key',
    };

    jest.doMock('../../src/lib/prisma', () => ({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          auth_provider: 'Email',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    }));
    jest.doMock('../../src/utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.dontMock('../../src/lib/prisma');
    jest.dontMock('../../src/utils/logger');
  });

  test('does not expose dev_reset_code in production', async () => {
    const authService = require('../../src/domains/auth/auth.service');

    const result = await authService.forgotPassword('user@example.com');

    expect(result).toEqual({ message: 'Code sent' });
    expect(result.dev_reset_code).toBeUndefined();
  });
});
