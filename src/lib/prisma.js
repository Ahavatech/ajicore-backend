const { PrismaClient } = require('@prisma/client');

// Reuse a single Prisma client across the app to avoid leaking connections
// during tests and development hot reloads.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.__ajicorePrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__ajicorePrisma = prisma;
}

module.exports = prisma;
