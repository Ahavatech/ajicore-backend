jest.mock('../../src/lib/prisma', () => ({
  business: {
    findUnique: jest.fn(),
  },
}));

jest.mock('../../src/integrations/sms/twilio_gateway', () => ({
  sendMessage: jest.fn(),
  makeCall: jest.fn(),
}));

jest.mock('../../src/domains/ai_logs/activity_log.service', () => ({
  logActivitySafe: jest.fn(),
}));

const prisma = require('../../src/lib/prisma');
const twilioGateway = require('../../src/integrations/sms/twilio_gateway');
const { logActivitySafe } = require('../../src/domains/ai_logs/activity_log.service');
const notificationService = require('../../src/domains/communications/notification.service');

describe('notification.service Twilio production flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sendSms prefers the business AI number as the sender', async () => {
    prisma.business.findUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Ajicore Plumbing',
      ai_phone_number: '+17473194976',
    });
    twilioGateway.sendMessage.mockResolvedValue({
      sid: 'SM123',
      status: 'queued',
      to: '+2349011774616',
      from: '+17473194976',
    });

    const result = await notificationService.sendSms(
      '+2349011774616',
      'Test SMS from Ajicore.',
      { business_id: 'biz-1', customer_name: 'Iyanu' }
    );

    expect(twilioGateway.sendMessage).toHaveBeenCalledWith(
      '+2349011774616',
      'Test SMS from Ajicore.',
      { from: '+17473194976' }
    );
    expect(logActivitySafe).toHaveBeenCalledWith(expect.objectContaining({
      business_id: 'biz-1',
      event_type: 'sms.outbound_sent',
    }));
    expect(result.sid).toBe('SM123');
  });

  test('makeCall places an outbound call with inline TwiML and business sender', async () => {
    prisma.business.findUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Ajicore Plumbing',
      ai_phone_number: '+17473194976',
    });
    twilioGateway.makeCall.mockResolvedValue({
      sid: 'CA123',
      status: 'queued',
      to: '+2349011774616',
      from: '+17473194976',
    });

    const result = await notificationService.makeCall(
      '+2349011774616',
      { message: 'Hello from Ajicore. This is a production voice test.' },
      { business_id: 'biz-1', customer_name: 'Iyanu' }
    );

    expect(twilioGateway.makeCall).toHaveBeenCalledWith(
      '+2349011774616',
      expect.objectContaining({
        from: '+17473194976',
        twiml: expect.stringContaining('Hello from Ajicore. This is a production voice test.'),
      })
    );
    expect(logActivitySafe).toHaveBeenCalledWith(expect.objectContaining({
      business_id: 'biz-1',
      event_type: 'call.outbound_started',
    }));
    expect(result.sid).toBe('CA123');
  });
});
