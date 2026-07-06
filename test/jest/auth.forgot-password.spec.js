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
      MAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'smtp-user',
      SMTP_PASS: 'smtp-pass',
      MAIL_FROM_EMAIL: 'noreply@example.com',
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
    jest.doMock('../../src/domains/communications/email.service', () => ({
      sendPasswordResetOtpEmail: jest.fn().mockResolvedValue({ messageId: 'mail-1' }),
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.dontMock('../../src/lib/prisma');
    jest.dontMock('../../src/utils/logger');
    jest.dontMock('../../src/domains/communications/email.service');
  });

  test('does not expose dev_reset_code in production', async () => {
    const authService = require('../../src/domains/auth/auth.service');

    const result = await authService.forgotPassword({ email: 'user@example.com' });

    expect(result).toEqual({ message: 'If an account exists, a reset code has been sent.' });
    expect(result.dev_reset_code).toBeUndefined();
  });
});
