jest.mock('../../src/lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://localhost:5432/test';
process.env.NODE_ENV = 'test';

const bcrypt = require('bcryptjs');
const prisma = require('../../src/lib/prisma');
const authService = require('../../src/domains/auth/auth.service');

describe('auth.service signup validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bcrypt.hash.mockResolvedValue('hashed-password');
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      password_hash: 'hashed-password',
      auth_provider: 'Email',
      onboarding_step: 2,
    });
  });

  test('rejects missing email with a friendly message', async () => {
    await expect(authService.signup({ password: 'password123' }))
      .rejects.toThrow('Please enter your email address.');
  });

  test('rejects invalid email with a friendly message', async () => {
    await expect(authService.signup({ email: 'not-an-email', password: 'password123' }))
      .rejects.toThrow('Please enter a valid email address.');
  });

  test('rejects missing password with a friendly message', async () => {
    await expect(authService.signup({ email: 'user@example.com' }))
      .rejects.toThrow('Please enter a password.');
  });

  test('rejects short password with a friendly message', async () => {
    await expect(authService.signup({ email: 'user@example.com', password: 'short' }))
      .rejects.toThrow('Password must be at least 8 characters long.');
  });

  test('normalizes email before creating the user', async () => {
    await authService.signup({ email: ' USER@Example.COM ', password: 'password123' });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'user@example.com',
      }),
    }));
  });
});
