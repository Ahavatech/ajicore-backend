describe('internal AI auth middleware', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../src/config/env', () => ({
      INTERNAL_API_KEY: 'internal-key',
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

  test('requireInternalApiKey accepts only INTERNAL_API_KEY', () => {
    const { requireInternalApiKey } = require('../../src/api/middlewares/auth.middleware');

    const next = jest.fn();
    const okRes = makeResponse();
    requireInternalApiKey({
      headers: { 'x-api-key': 'internal-key' },
      ip: '127.0.0.1',
      originalUrl: '/api/internal/ai/jobs',
    }, okRes, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(okRes.status).not.toHaveBeenCalled();

    const failRes = makeResponse();
    requireInternalApiKey({
      headers: { 'x-api-key': 'ai-service-key' },
      ip: '127.0.0.1',
      originalUrl: '/api/internal/ai/jobs',
    }, failRes, jest.fn());

    expect(failRes.status).toHaveBeenCalledWith(401);
  });

  test('requireAuth accepts case-insensitive Bearer headers with flexible spacing', () => {
    const authService = require('../../src/domains/auth/auth.service');
    authService.verifyToken.mockReturnValue({ id: 'user-1', email: 'owner@example.com' });
    const { requireAuth } = require('../../src/api/middlewares/auth.middleware');

    for (const authorization of ['Bearer jwt-token', 'bearer jwt-token', 'Bearer    jwt-token']) {
      const req = { headers: { authorization } };
      const res = makeResponse();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(authService.verifyToken).toHaveBeenCalledWith('jwt-token');
      expect(req.user).toEqual({ id: 'user-1', email: 'owner@example.com' });
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    }
  });
});
