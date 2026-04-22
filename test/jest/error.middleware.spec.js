jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://localhost:5432/test';
process.env.NODE_ENV = 'test';

const { errorHandler } = require('../../src/api/middlewares/error.middleware');
const { ValidationError, ConflictError } = require('../../src/utils/errors');

function runErrorHandler(err) {
  const req = {
    id: 'request-1',
    path: '/api/auth/signup',
    method: 'POST',
    ip: '127.0.0.1',
    user: null,
  };
  const res = {
    statusCode: null,
    payload: null,
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(payload) {
      this.payload = payload;
      return this;
    }),
    set: jest.fn(),
  };

  errorHandler(err, req, res, jest.fn());
  return res;
}

describe('error middleware user-facing messages', () => {
  test('returns specific validation messages', () => {
    const res = runErrorHandler(new ValidationError('Password must be at least 8 characters long.'));

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe('Password must be at least 8 characters long.');
  });

  test('returns specific conflict messages', () => {
    const res = runErrorHandler(new ConflictError('An account with this email already exists.'));

    expect(res.statusCode).toBe(409);
    expect(res.payload.message).toBe('An account with this email already exists.');
  });
});
