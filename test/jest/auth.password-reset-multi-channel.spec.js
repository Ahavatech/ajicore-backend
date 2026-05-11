const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../src/lib/prisma', () => mockPrisma);
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../src/domains/communications/email.service', () => ({
  sendPasswordResetOtpEmail: jest.fn().mockResolvedValue({ messageId: 'mail-1' }),
}));
jest.mock('twilio', () => jest.fn(() => ({
  messages: {
    create: jest.fn().mockResolvedValue({ sid: 'SM123', status: 'queued' }),
  },
})));

describe('auth password reset multi-channel flow', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      DATABASE_URL: 'postgres://localhost:5432/test',
      PASSWORD_RESET_ALLOW_EMAIL: 'true',
      PASSWORD_RESET_ALLOW_SMS: 'true',
      PASSWORD_RESET_CODE_TTL_MINUTES: '10',
      PASSWORD_RESET_CODE_LENGTH: '5',
      STRIPE_SECRET_KEY: 'sk_test_example',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_example',
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'auth-token',
      TWILIO_PHONE_NUMBER: '+15555550100',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('forgotPassword supports email and stores dedicated reset fields', async () => {
    const authService = require('../../src/domains/auth/auth.service');
    const emailService = require('../../src/domains/communications/email.service');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      first_name: 'Aji',
      last_name: 'Core',
      auth_provider: 'Email',
    });
    mockPrisma.user.update.mockResolvedValue({});

    const result = await authService.forgotPassword({ email: 'owner@example.com' });

    expect(result.message).toBe('If an account exists, a reset code has been sent.');
    expect(result.dev_reset_code).toMatch(/^\d{5}$/);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        password_reset_code: expect.any(String),
        password_reset_channel: 'email',
        password_reset_used_at: null,
      }),
    }));
    expect(emailService.sendPasswordResetOtpEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@example.com',
      userName: 'Aji Core',
    }));
  });

  test('verifyResetCode supports phone identifier', async () => {
    const authService = require('../../src/domains/auth/auth.service');

    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      phone_number: '+15555550123',
      auth_provider: 'Email',
      password_reset_code: '12345',
      password_reset_expires_at: new Date(Date.now() + 5 * 60 * 1000),
      password_reset_used_at: null,
    });

    const result = await authService.verifyResetCode({ identifier: '+15555550123', code: '12345' });

    expect(result).toEqual({ message: 'Valid', valid: true });
  });

  test('resetPassword invalidates the code after success', async () => {
    const authService = require('../../src/domains/auth/auth.service');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      auth_provider: 'Email',
      password_reset_code: '12345',
      password_reset_expires_at: new Date(Date.now() + 5 * 60 * 1000),
      password_reset_used_at: null,
    });
    mockPrisma.user.update.mockResolvedValue({});

    const result = await authService.resetPassword({
      email: 'owner@example.com',
      code: '12345',
      new_password: 'NewSecret123!',
    });

    expect(result).toEqual({ message: 'Password reset successfully.' });
    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        password_reset_code: null,
        password_reset_expires_at: null,
        password_reset_used_at: expect.any(Date),
      }),
    }));
  });
});
