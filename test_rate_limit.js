/**
 * Rate Limiting Test
 * Demonstrates the rate limiting middleware functionality
 */
const { rateLimit, getRateLimitStats, getRateLimitStatus } = require('./src/api/middlewares/rate_limit.middleware');

// Mock request/response objects
function createMockReq(ip = '192.168.1.1') {
  return {
    ip,
    connection: { remoteAddress: ip },
    socket: { remoteAddress: ip },
    headers: {},
    method: 'GET',
    originalUrl: '/api/test'
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    set(headers) {
      Object.assign(res.headers, headers);
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.responseData = data;
      return res;
    }
  };
  return res;
}

function createMockNext() {
  return function() { this.called = true; };
}

async function testRateLimiting() {
  console.log('Testing Rate Limiting Middleware...\n');

  // Test 1: Basic rate limiting
  console.log('1. Testing basic rate limiting (3 requests per minute):');
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3
  });

  for (let i = 1; i <= 5; i++) {
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    limiter(req, res, next);

    if (res.responseData) {
      console.log(`   Request ${i}: BLOCKED - ${res.responseData.message}`);
      console.log(`   Headers: X-RateLimit-Remaining=${res.headers['X-RateLimit-Remaining']}, Retry-After=${res.headers['Retry-After']}`);
      break;
    } else {
      console.log(`   Request ${i}: ALLOWED - Remaining: ${res.headers['X-RateLimit-Remaining']}`);
    }
  }

  // Test 2: Different IPs
  console.log('\n2. Testing different IP addresses:');
  const ips = ['10.0.0.1', '10.0.0.2', '10.0.0.3'];

  for (const ip of ips) {
    const req = createMockReq(ip);
    const res = createMockRes();
    const next = createMockNext();

    limiter(req, res, next);

    if (res.responseData) {
      console.log(`   IP ${ip}: BLOCKED`);
    } else {
      console.log(`   IP ${ip}: ALLOWED - Remaining: ${res.headers['X-RateLimit-Remaining']}`);
    }
  }

  // Test 3: Statistics
  console.log('\n3. Rate limit statistics:');
  const stats = getRateLimitStats();
  console.log('   Total keys tracked:', stats.totalKeys);
  console.log('   Active limits:', stats.activeLimits);
  console.log('   Memory usage (chars):', stats.memoryUsage);

  // Test 4: Status check
  console.log('\n4. Checking rate limit status for specific IP:');
  const status = getRateLimitStatus('192.168.1.1');
  if (status) {
    console.log('   Count:', status.count);
    console.log('   Reset time:', new Date(status.resetTime).toISOString());
  } else {
    console.log('   No rate limit data found');
  }

  console.log('\nRate limiting tests completed!');
}

// Run the test
testRateLimiting().catch(console.error);