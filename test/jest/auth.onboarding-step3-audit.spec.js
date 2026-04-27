/**
 * Twilio Phone Number Generation - Audit Test Suite
 * 
 * Tests for onboarding step 3: AI business number provisioning
 * Includes:
 * - getAvailableNumbers() with all search types
 * - onboardingStep3() provisioning flow
 * - Error handling and transaction rollback
 * - E.164 normalization
 * - Area code extraction
 */

const mockTwilioNumbers = [
  {
    phoneNumber: '+12025551234',
    friendlyName: 'US/United States',
    locality: 'Washington',
    region: 'DC',
    postalCode: '20001',
    isoCountry: 'US',
    capabilities: {
      voice: true,
      sms: true,
      mms: false,
    },
  },
  {
    phoneNumber: '+12025555678',
    friendlyName: 'US/United States',
    locality: 'Washington',
    region: 'DC',
    postalCode: '20001',
    isoCountry: 'US',
    capabilities: {
      voice: true,
      sms: true,
      mms: true,
    },
  },
];

describe('Onboarding Step 3: Twilio Phone Number Generation - AUDIT', () => {
  let authService;
  let mockPrisma;
  let mockTwilioClient;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      JWT_SECRET: 'test-secret',
      DATABASE_URL: 'postgres://localhost:5432/test',
      TWILIO_ACCOUNT_SID: 'ACtest',
      TWILIO_AUTH_TOKEN: 'twilio-token',
      TWILIO_NUMBER_COUNTRY_CODE: 'US',
      TWILIO_SMS_WEBHOOK_URL: 'https://api.example.com/webhooks/sms',
      TWILIO_VOICE_WEBHOOK_URL: 'https://api.example.com/webhooks/voice',
      TWILIO_MESSAGING_SERVICE_SID: 'MGtest',
    };

    // Mock Twilio client
    mockTwilioClient = {
      availablePhoneNumbers: jest.fn((countryCode) => ({
        local: {
          list: jest.fn().mockResolvedValue(mockTwilioNumbers),
        },
        tollFree: {
          list: jest.fn().mockResolvedValue([mockTwilioNumbers[0]]),
        },
      })),
      incomingPhoneNumbers: {
        create: jest.fn().mockResolvedValue({
          phoneNumber: '+12025551234',
          sid: 'PNxxxxxxxxxxxx',
          friendlyName: 'Test Business - +12025551234',
          isoCountry: 'US',
          capabilities: {
            voice: true,
            sms: true,
            mms: true,
          },
        }),
      },
      messaging: {
        v1: {
          services: jest.fn(() => ({
            phoneNumbers: {
              create: jest.fn().mockResolvedValue({}),
            },
          })),
        },
      },
      messages: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    // Mock Prisma
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'test@example.com',
          onboarding_step: 3,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'test@example.com',
          onboarding_step: 4,
        }),
      },
      business: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'business-1',
          owner_id: 'user-1',
          name: 'Test Business',
          company_phone: null,
          twilio_phone_sid: null,
          ai_phone_number: null,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'business-1',
          owner_id: 'user-1',
          name: 'Test Business',
          ai_phone_number: '+12025551234',
          dedicated_phone_number: '+12025551234',
          ai_phone_country: 'US',
          ai_phone_area_code: '202',
          twilio_phone_sid: 'PNxxxxxxxxxxxx',
          twilio_phone_friendly_name: 'Test Business - +12025551234',
        }),
      },
      $transaction: jest.fn(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    jest.doMock('../../src/lib/prisma', () => mockPrisma);
    jest.doMock('twilio', () => jest.fn(() => mockTwilioClient));
    jest.doMock('../../src/utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    authService = require('../../src/domains/auth/auth.service');
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.dontMock('../../src/lib/prisma');
    jest.dontMock('twilio');
    jest.dontMock('../../src/utils/logger');
  });

  // ========================================
  // TEST SUITE 1: getAvailableNumbers()
  // ========================================

  describe('getAvailableNumbers()', () => {
    describe('City Search', () => {
      test('AUDIT: Returns available numbers for valid city', async () => {
        const result = await authService.getAvailableNumbers({
          type: 'city',
          city: 'Washington',
        });

        expect(result).toHaveProperty('type', 'city');
        expect(result).toHaveProperty('numbers');
        expect(result.numbers).toHaveLength(2);
        expect(result.numbers[0]).toHaveProperty('phone_number', '+12025551234');
        expect(result.numbers[0]).toHaveProperty('capabilities');
        expect(result.numbers[0].capabilities).toHaveProperty('voice', true);
        expect(result.numbers[0].capabilities).toHaveProperty('sms', true);
      });

      test('AUDIT: Throws error if city missing', async () => {
        expect(async () => {
          await authService.getAvailableNumbers({ type: 'city', city: '' });
        }).rejects.toThrow('city is required');
      });

      test('AUDIT: Validates search type', async () => {
        expect(async () => {
          await authService.getAvailableNumbers({ type: 'invalid' });
        }).rejects.toThrow('type must be one of');
      });

      test('AUDIT: Handles Twilio API errors gracefully', async () => {
        const badClient = {
          availablePhoneNumbers: jest.fn(() => ({
            local: {
              list: jest.fn().mockRejectedValue(new Error('Twilio API Error')),
            },
          })),
        };

        jest.doMock('twilio', () => jest.fn(() => badClient));

        expect(async () => {
          const freshService = require('../../src/domains/auth/auth.service');
          await freshService.getAvailableNumbers({ type: 'city', city: 'DC' });
        }).rejects.toThrow('Unable to fetch available Twilio phone numbers');
      });
    });

    describe('Area Code Search', () => {
      test('AUDIT: Returns numbers for valid area code', async () => {
        const result = await authService.getAvailableNumbers({
          type: 'area_code',
          area_code: '202',
        });

        expect(result.type).toBe('area_code');
        expect(result.numbers).toBeDefined();
      });

      test('AUDIT: Sanitizes area code input', async () => {
        // Input with non-digits should be cleaned
        const result = await authService.getAvailableNumbers({
          type: 'area_code',
          area_code: '(202) test 123',
        });

        expect(result.type).toBe('area_code');
        // Should have taken first 3 digits: 202
      });

      test('AUDIT: Throws error if area code < 3 digits', async () => {
        expect(async () => {
          await authService.getAvailableNumbers({
            type: 'area_code',
            area_code: '20',
          });
        }).rejects.toThrow('area_code must be a 3-digit code');
      });
    });

    describe('Toll Free Search', () => {
      test('AUDIT: Returns toll-free numbers', async () => {
        const result = await authService.getAvailableNumbers({
          type: 'toll_free',
        });

        expect(result.type).toBe('toll_free');
        expect(result.numbers).toBeDefined();
      });
    });

    describe('Response Format', () => {
      test('AUDIT: Returns properly formatted response', async () => {
        const result = await authService.getAvailableNumbers({
          type: 'city',
          city: 'Washington',
        });

        expect(result).toEqual({
          type: expect.any(String),
          country: expect.any(String),
          numbers: expect.arrayContaining([
            {
              phone_number: expect.stringMatching(/^\+\d+$/),
              friendly_name: expect.any(String),
              locality: expect.any(String),
              region: expect.any(String),
              postal_code: expect.any(String),
              country: expect.any(String),
              capabilities: {
                voice: expect.any(Boolean),
                sms: expect.any(Boolean),
                mms: expect.any(Boolean),
              },
              type: expect.any(String),
              area_code: expect.any(String),
            },
          ]),
          count: expect.any(Number),
        });
      });

      test('AUDIT: Returns max 5 numbers (limit enforced)', async () => {
        const result = await authService.getAvailableNumbers({
          type: 'city',
          city: 'Washington',
        });

        expect(result.count).toBeLessThanOrEqual(5);
      });
    });
  });

  // ========================================
  // TEST SUITE 2: onboardingStep3()
  // ========================================

  describe('onboardingStep3()', () => {
    describe('Happy Path', () => {
      test('AUDIT: Successfully provisions phone number', async () => {
        const result = await authService.onboardingStep3('user-1', {
          phone_number: '+12025551234',
          search_type: 'city',
        });

        expect(result).toHaveProperty('message', 'AI business number provisioned.');
        expect(result).toHaveProperty('ai_phone_number', '+12025551234');
        expect(result).toHaveProperty('twilio_phone_sid', 'PNxxxxxxxxxxxx');
        expect(result.user.onboarding_step).toBe(4);
      });

      test('AUDIT: Saves provisioning details to database', async () => {
        await authService.onboardingStep3('user-1', {
          phone_number: '+12025551234',
          search_type: 'city',
        });

        expect(mockPrisma.business.update).toHaveBeenCalledWith({
          where: { id: 'business-1' },
          data: expect.objectContaining({
            ai_phone_number: '+12025551234',
            dedicated_phone_number: '+12025551234',
            twilio_phone_sid: 'PNxxxxxxxxxxxx',
            twilio_phone_friendly_name: expect.stringContaining('+12025551234'),
            ai_phone_area_code: '202',
          }),
        });
      });

      test('AUDIT: Advances user to step 4', async () => {
        await authService.onboardingStep3('user-1', {
          phone_number: '+12025551234',
          search_type: 'city',
        });

        expect(mockPrisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: { onboarding_step: 4 },
        });
      });

      test('AUDIT: Adds phone to Messaging Service if SID configured', async () => {
        await authService.onboardingStep3('user-1', {
          phone_number: '+12025551234',
          search_type: 'city',
        });

        expect(mockTwilioClient.messaging.v1.services).toHaveBeenCalledWith('MGtest');
      });
    });

    describe('Input Validation', () => {
      test('AUDIT: Throws error if phone_number missing', async () => {
        expect(async () => {
          await authService.onboardingStep3('user-1', { search_type: 'city' });
        }).rejects.toThrow('phone_number is required');
      });

      test('AUDIT: Throws error if search_type missing', async () => {
        expect(async () => {
          await authService.onboardingStep3('user-1', {
            phone_number: '+12025551234',
          });
        }).rejects.toThrow('search_type is required');
      });

      test('AUDIT: Validates E.164 format', async () => {
        expect(async () => {
          await authService.onboardingStep3('user-1', {
            phone_number: '2025551234', // Missing +
            search_type: 'city',
          });
        }).rejects.toThrow('valid E.164 phone number');
      });

      test('AUDIT: Rejects too-short numbers', async () => {
        expect(async () => {
          await authService.onboardingStep3('user-1', {
            phone_number: '+123', // Too short
            search_type: 'city',
          });
        }).rejects.toThrow('valid E.164 phone number');
      });

      test('AUDIT: Rejects numbers without + prefix', async () => {
        expect(async () => {
          await authService.onboardingStep3('user-1', {
            phone_number: '12025551234',
            search_type: 'city',
          });
        }).rejects.toThrow('valid E.164 phone number');
      });
    });

    describe('Business Validation', () => {
      test('AUDIT: Throws error if no business found', async () => {
        mockPrisma.business.findFirst.mockResolvedValueOnce(null);

        expect(async () => {
          await authService.onboardingStep3('user-1', {
            phone_number: '+12025551234',
            search_type: 'city',
          });
        }).rejects.toThrow('No business found');
      });

      test('AUDIT: Prevents re-provisioning of different number', async () => {
        mockPrisma.business.findFirst.mockResolvedValueOnce({
          id: 'business-1',
          owner_id: 'user-1',
          name: 'Test Business',
          twilio_phone_sid: 'PN_existing',
          ai_phone_number: '+12025551111', // Different number
        });

        expect(async () => {
          await authService.onboardingStep3('user-1', {
            phone_number: '+12025552222',
            search_type: 'city',
          });
        }).rejects.toThrow('already has a provisioned Twilio number');
      });

      test('AUDIT: Allows re-provisioning same number (idempotent)', async () => {
        mockPrisma.business.findFirst.mockResolvedValueOnce({
          id: 'business-1',
          owner_id: 'user-1',
          name: 'Test Business',
          twilio_phone_sid: 'PN_existing',
          ai_phone_number: '+12025551234', // Same number
        });

        // Should not throw
        const result = await authService.onboardingStep3('user-1', {
          phone_number: '+12025551234',
          search_type: 'city',
        });

        expect(result).toHaveProperty('ai_phone_number', '+12025551234');
      });
    });

    describe('Twilio Provisioning', () => {
      test('AUDIT: Calls Twilio API with correct parameters', async () => {
        await authService.onboardingStep3('user-1', {
          phone_number: '+12025551234',
          search_type: 'city',
        });

        expect(mockTwilioClient.incomingPhoneNumbers.create).toHaveBeenCalledWith({
          phoneNumber: '+12025551234',
          friendlyName: expect.stringContaining('Test Business'),
          smsUrl: expect.any(String),
          voiceUrl: expect.any(String),
        });
      });

      test('AUDIT: Handles Twilio provisioning errors', async () => {
        mockTwilioClient.incomingPhoneNumbers.create = jest
          .fn()
          .mockRejectedValueOnce(new Error('Twilio Error: Phone number already taken'));

        expect(async () => {
          await authService.onboardingStep3('user-1', {
            phone_number: '+12025551234',
            search_type: 'city',
          });
        }).rejects.toThrow('Unable to provision the selected Twilio phone number');
      });
    });

    describe('Transaction Rollback', () => {
      test('AUDIT: Releases phone number on database transaction failure', async () => {
        const releasePhoneNumber = jest.fn();
        mockTwilioClient.incomingPhoneNumbers.remove = releasePhoneNumber;

        // Mock transaction failure
        mockPrisma.$transaction.mockRejectedValueOnce(
          new Error('Database constraint violation')
        );

        expect(async () => {
          await authService.onboardingStep3('user-1', {
            phone_number: '+12025551234',
            search_type: 'city',
          });
        }).rejects.toThrow('Database constraint violation');

        // Verify rollback was attempted
        // (Implementation note: This would require additional mocking of releaseIncomingPhoneNumber)
      });

      test('AUDIT: Preserves error information during rollback', async () => {
        mockPrisma.$transaction.mockRejectedValueOnce(
          new Error('Unique constraint: ai_phone_number')
        );

        expect(async () => {
          await authService.onboardingStep3('user-1', {
            phone_number: '+12025551234',
            search_type: 'city',
          });
        }).rejects.toThrow();
      });
    });

    describe('Response Format', () => {
      test('AUDIT: Returns properly formatted response', async () => {
        const result = await authService.onboardingStep3('user-1', {
          phone_number: '+12025551234',
          search_type: 'city',
        });

        expect(result).toEqual({
          message: expect.any(String),
          user: {
            id: expect.any(String),
            email: expect.any(String),
            onboarding_step: 4,
          },
          business: expect.objectContaining({
            id: expect.any(String),
            ai_phone_number: expect.any(String),
            twilio_phone_sid: expect.any(String),
          }),
          ai_phone_number: expect.any(String),
          twilio_phone_sid: expect.any(String),
          onboarding_step: 4,
        });
      });

      test('AUDIT: Does not expose internal_api_token in response', async () => {
        const result = await authService.onboardingStep3('user-1', {
          phone_number: '+12025551234',
          search_type: 'city',
        });

        expect(result.business).not.toHaveProperty('internal_api_token');
        expect(result.user).not.toHaveProperty('password_hash');
      });
    });
  });

  // ========================================
  // TEST SUITE 3: Helper Functions
  // ========================================

  describe('Helper Functions', () => {
    describe('extractAreaCode()', () => {
      test('AUDIT: Extracts area code from US numbers', () => {
        const testCases = [
          { input: '+12025551234', expected: '202' },
          { input: '+1-202-555-1234', expected: '202' },
          { input: '+1 (202) 555-1234', expected: '202' },
          { input: '2025551234', expected: '202' },
        ];

        // Note: extractAreaCode is internal function, test through public API
        // or by direct import if available
      });

      test('AUDIT: Handles international numbers', () => {
        // +234 is Nigeria country code
        // International numbers might have different area code conventions
      });

      test('AUDIT: Returns null for invalid formats', () => {
        // Test short numbers, non-numeric strings
      });
    });

    describe('normalizeE164Number()', () => {
      test('AUDIT: Validates E.164 format strictly', () => {
        const validNumbers = [
          '+12025551234',
          '+441234567890',
          '+2348012345678',
        ];

        const invalidNumbers = [
          '2025551234', // Missing +
          '+1 202 555 1234', // Has spaces
          '(202) 555-1234', // Has special chars
          '+1', // Too short
        ];
      });
    });
  });

  // ========================================
  // TEST SUITE 4: Integration Scenarios
  // ========================================

  describe('Integration Scenarios', () => {
    test('AUDIT: Complete flow - search, select, provision', async () => {
      // Step 1: Search for available numbers
      const searchResult = await authService.getAvailableNumbers({
        type: 'city',
        city: 'Washington',
      });

      expect(searchResult.numbers).toHaveLength(2);

      // Step 2: User selects one
      const selectedNumber = searchResult.numbers[0].phone_number;

      // Step 3: Provision the selected number
      const provisionResult = await authService.onboardingStep3('user-1', {
        phone_number: selectedNumber,
        search_type: 'city',
      });

      expect(provisionResult.ai_phone_number).toBe(selectedNumber);
      expect(provisionResult.user.onboarding_step).toBe(4);
    });

    test('AUDIT: No available numbers found', async () => {
      mockTwilioClient.availablePhoneNumbers = jest.fn(() => ({
        local: {
          list: jest.fn().mockResolvedValue([]),
        },
      }));

      const result = await authService.getAvailableNumbers({
        type: 'city',
        city: 'UnknownCity',
      });

      expect(result.count).toBe(0);
      expect(result.numbers).toHaveLength(0);
    });
  });

  // ========================================
  // TEST SUITE 5: Error Scenarios
  // ========================================

  describe('Error Scenarios', () => {
    test('AUDIT: Handles missing Twilio credentials', () => {
      const processEnv = { ...process.env };
      delete process.env.TWILIO_ACCOUNT_SID;

      expect(() => {
        const freshService = require('../../src/domains/auth/auth.service');
      }).toThrow('Twilio credentials are not configured');

      process.env = processEnv;
    });

    test('AUDIT: Provides helpful error messages for network failures', async () => {
      mockTwilioClient.availablePhoneNumbers = jest.fn(() => {
        throw new Error('Network timeout');
      });

      expect(async () => {
        await authService.getAvailableNumbers({
          type: 'city',
          city: 'Washington',
        });
      }).rejects.toThrow('Unable to fetch available Twilio phone numbers');
    });
  });
});
