/**
 * Test the updated validation middleware with query parameter support
 */
const { requireFields } = require('./src/api/middlewares/validate.middleware');

// Mock request/response objects
function createMockReq(query = {}, body = {}) {
  return { query, body };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    json(data) { res.responseData = data; return res; }
  };
  return res;
}

function createMockNext() {
  return function() { this.called = true; };
}

console.log('Testing updated requireFields with query parameter support...\n');

// Test 1: Query parameter validation
console.log('1. Testing query parameter validation:');
const req1 = createMockReq({ business_id: '', phone: '1234567890' });
const res1 = createMockRes();
const next1 = createMockNext();
requireFields(['business_id', 'phone'], 'query')(req1, res1, next1);
console.log('   Query:', req1.query);
console.log('   Result:', res1.responseData || 'Validation passed');
console.log('   Next called:', next1.called ? 'Yes' : 'No');

// Test 2: Body parameter validation (default)
console.log('\n2. Testing body parameter validation (default):');
const req2 = createMockReq({}, { name: 'John', email: 'john@example.com' });
const res2 = createMockRes();
const next2 = createMockNext();
requireFields(['name', 'email'])(req2, res2, next2);
console.log('   Body:', req2.body);
console.log('   Result:', res2.responseData || 'Validation passed');
console.log('   Next called:', next2.called ? 'Yes' : 'No');

// Test 3: Missing query parameter
console.log('\n3. Testing missing query parameter:');
const req3 = createMockReq({ business_id: '123' });
const res3 = createMockRes();
const next3 = createMockNext();
requireFields(['business_id', 'phone'], 'query')(req3, res3, next3);
console.log('   Query:', req3.query);
console.log('   Result:', res3.responseData || 'Validation passed');
console.log('   Next called:', next3.called ? 'Yes' : 'No');

console.log('\nQuery parameter validation tests completed!');