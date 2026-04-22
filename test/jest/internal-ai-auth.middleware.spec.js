describe('internal AI auth middleware', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../src/config/env', () => ({
      INTERNAL_API_KEY: 'internal-key',
      AI_SERVICE_API_KEY: 'ai-service-key',
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '7d',
    }));
    jest.doMock('../../src/lib/prisma', () => ({}));
    jest.doMock('../../src/domains/auth/auth.service', () => ({
      verifyToken: jest.fn(),
    }));
    jest.doMock('../../src/utils/logger', () => ({
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.dontMock('../../src/config/env');
    jest.dontMock('../../src/lib/prisma');
    jest.dontMock('../../src/domains/auth/auth.service');
    jest.dontMock('../../src/utils/logger');
  });

  function makeResponse() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  }

  test('requireAiServiceApiKey accepts AI_SERVICE_API_KEY, not INTERNAL_API_KEY', () => {
    const { requireAiServiceApiKey } = require('../../src/api/middlewares/auth.middleware');
    const next = jest.fn();
    const okRes = makeResponse();

    requireAiServiceApiKey({
      headers: { 'x-api-key': 'ai-service-key' },
      ip: '127.0.0.1',
      originalUrl: '/api/internal/ai/business-config',
    }, okRes, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(okRes.status).not.toHaveBeenCalled();

    const failRes = makeResponse();
    requireAiServiceApiKey({
      headers: { 'x-api-key': 'internal-key' },
      ip: '127.0.0.1',
      originalUrl: '/api/internal/ai/business-config',
    }, failRes, jest.fn());

    expect(failRes.status).toHaveBeenCalledWith(401);
    expect(failRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid or missing AI service API key.',
    });
  });
});
