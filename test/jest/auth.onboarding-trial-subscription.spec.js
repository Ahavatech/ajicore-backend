const mockPrisma = {
  $transaction: jest.fn(),
  user: {
    findUnique: jest.fn(),
  },
};

const mockSubscriptionService = {
  ensureTrialSubscriptionForBusiness: jest.fn().mockResolvedValue({
    already_active: false,
  }),
};

jest.mock('../../src/lib/prisma', () => mockPrisma);
jest.mock('../../src/domains/subscriptions/subscription.service', () => mockSubscriptionService);
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../src/domains/communications/email.service', () => ({
  sendPasswordResetOtpEmail: jest.fn(),
}));

describe('auth onboarding trial subscription sync', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    process.env.NODE_ENV = 'test';

    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          update: jest
            .fn()
            .mockResolvedValueOnce({ id: 'user-1', email: 'owner@example.com', onboarding_step: 3 })
            .mockResolvedValueOnce({ id: 'user-1', email: 'owner@example.com', business_id: 'biz-1' }),
        },
        business: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'biz-1',
            owner_id: 'user-1',
            name: 'Ajicore Services',
            company_email: 'owner@example.com',
            internal_api_token: 'token-1',
          }),
          update: jest.fn(),
        },
      };

      return callback(tx);
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      first_name: 'Aji',
      last_name: 'Core',
      role: 'admin',
      business_id: 'biz-1',
      staff_id: null,
      business: null,
      staff_profile: null,
      owned_businesses: [],
    });
  });

  test('onboardingStep2 auto-syncs the trial subscription after business creation', async () => {
    const authService = require('../../src/domains/auth/auth.service');

    await authService.onboardingStep2('user-1', {
      first_name: 'Aji',
      last_name: 'Core',
      company_name: 'Ajicore Services',
      company_email: 'owner@example.com',
      company_type: 'Plumbing',
      business_structure: 'LLC',
    });

    expect(mockSubscriptionService.ensureTrialSubscriptionForBusiness).toHaveBeenCalledWith({
      userId: 'user-1',
      businessId: 'biz-1',
    });
  });

  test('onboardingStep2 succeeds when Stripe trial subscription provisioning is deferred', async () => {
    const logger = require('../../src/utils/logger');
    const authService = require('../../src/domains/auth/auth.service');

    mockSubscriptionService.ensureTrialSubscriptionForBusiness.mockRejectedValueOnce({
      name: 'StripeAPIError',
      message: "No such price: 'prod_UV3qWGRkCnLW6f'",
      code: 'resource_missing',
      statusCode: 404,
      type: 'StripeInvalidRequestError',
    });

    const result = await authService.onboardingStep2('user-1', {
      first_name: 'Aji',
      last_name: 'Core',
      company_name: 'Ajicore Services',
      company_email: 'owner@example.com',
      company_type: 'Plumbing',
      business_structure: 'LLC',
    });

    expect(result.message).toBe('Organization contact info saved.');
    expect(result.business.id).toBe('biz-1');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Trial subscription provisioning deferred for business biz-1'),
      expect.objectContaining({
        businessId: 'biz-1',
        userId: 'user-1',
        errorCode: 'resource_missing',
        statusCode: 404,
      })
    );
  });

  test('onboardingStep2 still throws for non-Stripe trial subscription failures', async () => {
    const logger = require('../../src/utils/logger');
    const authService = require('../../src/domains/auth/auth.service');

    mockSubscriptionService.ensureTrialSubscriptionForBusiness.mockRejectedValueOnce(
      new Error('unexpected database failure')
    );

    await expect(authService.onboardingStep2('user-1', {
      first_name: 'Aji',
      last_name: 'Core',
      company_name: 'Ajicore Services',
      company_email: 'owner@example.com',
      company_type: 'Plumbing',
      business_structure: 'LLC',
    })).rejects.toThrow('unexpected database failure');

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to provision trial subscription for business biz-1: unexpected database failure'
    );
  });
});
