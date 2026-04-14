jest.mock('../../src/lib/prisma', () => ({
  business: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  user: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
}));

jest.mock('twilio', () => {
  const localList = jest.fn();
  const tollFreeList = jest.fn();
  const incomingCreate = jest.fn();
  const messagingPhoneNumbersCreate = jest.fn();
  const messagesCreate = jest.fn();

  const factory = jest.fn(() => ({
    availablePhoneNumbers: jest.fn(() => ({
      local: { list: localList },
      tollFree: { list: tollFreeList },
    })),
    incomingPhoneNumbers: {
      create: incomingCreate,
    },
    messaging: {
      v1: {
        services: jest.fn(() => ({
          phoneNumbers: {
            create: messagingPhoneNumbersCreate,
          },
        })),
      },
    },
    messages: {
      create: messagesCreate,
    },
  }));

  factory.__mocks = {
    localList,
    tollFreeList,
    incomingCreate,
    messagingPhoneNumbersCreate,
    messagesCreate,
  };

  return factory;
}, { virtual: true });

const prisma = require('../../src/lib/prisma');
const twilio = require('twilio');
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://localhost:5432/test';
process.env.NODE_ENV = 'test';
process.env.TWILIO_ACCOUNT_SID = 'AC123';
process.env.TWILIO_AUTH_TOKEN = 'auth-token';
process.env.TWILIO_NUMBER_COUNTRY_CODE = 'US';
process.env.TWILIO_SMS_WEBHOOK_URL = 'https://example.com/sms';
process.env.TWILIO_VOICE_WEBHOOK_URL = 'https://example.com/voice';
process.env.TWILIO_STATUS_CALLBACK_URL = 'https://example.com/status';
process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG123';
const authService = require('../../src/domains/auth/auth.service');

describe('auth.service Twilio provisioning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getAvailableNumbers fetches local Twilio numbers', async () => {
    twilio.__mocks.localList.mockResolvedValue([
      {
        phoneNumber: '+12125550123',
        friendlyName: '(212) 555-0123',
        locality: 'New York',
        region: 'NY',
        postalCode: '10001',
        isoCountry: 'US',
        capabilities: { voice: true, sms: true, mms: false },
      },
    ]);

    const result = await authService.getAvailableNumbers({ type: 'area_code', area_code: '212' });

    expect(twilio.__mocks.localList).toHaveBeenCalledWith({ areaCode: 212, limit: 5 });
    expect(result.numbers).toEqual([
      expect.objectContaining({
        phone_number: '+12125550123',
        friendly_name: '(212) 555-0123',
        area_code: '212',
        capabilities: { voice: true, sms: true, mms: false },
      }),
    ]);
  });

  test('onboardingStep3 provisions and stores a Twilio number', async () => {
    prisma.business.findFirst.mockResolvedValue({
      id: 'biz-1',
      name: 'Ajicore Plumbing',
      owner_id: 'user-1',
      twilio_phone_sid: null,
      ai_phone_number: null,
    });
    prisma.user.update.mockResolvedValue({ id: 'user-1', email: 'owner@example.com', onboarding_step: 4 });
    prisma.business.update.mockResolvedValue({
      id: 'biz-1',
      ai_phone_number: '+12125550123',
      dedicated_phone_number: '+12125550123',
      twilio_phone_sid: 'PN123',
      twilio_phone_friendly_name: 'Ajicore Plumbing - +12125550123',
    });
    twilio.__mocks.incomingCreate.mockResolvedValue({
      sid: 'PN123',
      phoneNumber: '+12125550123',
      friendlyName: 'Ajicore Plumbing - +12125550123',
      isoCountry: 'US',
    });
    twilio.__mocks.messagingPhoneNumbersCreate.mockResolvedValue({ sid: 'PN123' });

    const result = await authService.onboardingStep3('user-1', {
      phone_number: '+12125550123',
      search_type: 'area_code',
      area_code: '212',
    });

    expect(twilio.__mocks.incomingCreate).toHaveBeenCalledWith({
      phoneNumber: '+12125550123',
      friendlyName: 'Ajicore Plumbing - +12125550123',
      smsUrl: 'https://example.com/sms',
      smsMethod: 'POST',
      voiceUrl: 'https://example.com/voice',
      voiceMethod: 'POST',
      statusCallback: 'https://example.com/status',
      statusCallbackMethod: 'POST',
    });
    expect(twilio.__mocks.messagingPhoneNumbersCreate).toHaveBeenCalledWith({ phoneNumberSid: 'PN123' });
    expect(prisma.business.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'biz-1' },
      data: expect.objectContaining({
        ai_phone_number: '+12125550123',
        dedicated_phone_number: '+12125550123',
        twilio_phone_sid: 'PN123',
      }),
    }));
    expect(result.ai_phone_number).toBe('+12125550123');
    expect(result.twilio_phone_sid).toBe('PN123');
  });
});
