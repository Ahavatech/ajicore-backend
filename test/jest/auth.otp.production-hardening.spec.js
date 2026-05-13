const mockMessagesCreate = jest.fn().mockResolvedValue({ sid: 'SM123', status: 'queued' });

const mockPrisma = {
  business: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
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
  sendPasswordResetOtpEmail: jest.fn(),
}));
jest.mock('twilio', () => jest.fn(() => ({
  messages: {
    create: mockMessagesCreate,
  },
})));

describe('auth OTP production hardening', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      DATABASE_URL: 'postgres://localhost:5432/test',
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'auth-token',
      TWILIO_PHONE_NUMBER: '+15555550100',
    };

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      onboarding_step: 2,
    });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.business.findFirst.mockResolvedValue({
      id: 'biz-1',
      owner_id: 'user-1',
    });
    mockPrisma.business.update.mockResolvedValue({});
    mockMessagesCreate.mockReset();
    mockMessagesCreate.mockResolvedValue({ sid: 'SM123', status: 'queued' });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('sendOtp never returns dev_otp', async () => {
    const authService = require('../../src/domains/auth/auth.service');

    const result = await authService.sendOtp('user-1', { phone_number: '+15555550123' });

    expect(result.dev_otp).toBeUndefined();
    expect(result.phone_number).toBeDefined();
  });

  test('sendOtp fails closed in production when Twilio send fails', async () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_API_KEY = 'internal-key';
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.MAIL_PROVIDER = 'smtp';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    process.env.MAIL_FROM_EMAIL = 'noreply@example.com';
    mockMessagesCreate.mockRejectedValueOnce(new Error('twilio down'));

    const authService = require('../../src/domains/auth/auth.service');

    await expect(authService.sendOtp('user-1', { phone_number: '+15555550123' }))
      .rejects.toThrow('Unable to send OTP right now. Please try again.');
  });

  test('skipOtp is disabled in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_API_KEY = 'internal-key';
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG123';
    process.env.MAIL_PROVIDER = 'smtp';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    process.env.MAIL_FROM_EMAIL = 'noreply@example.com';

    const authService = require('../../src/domains/auth/auth.service');

    await expect(authService.skipOtp('user-1'))
      .rejects.toThrow('Phone verification cannot be skipped in production.');
  });
});
