# Onboarding Step 3: Twilio Integration - Testing & Verification Guide

## Quick Start

### 1. Run the Audit Script
```bash
node scripts/audit-twilio-integration.js
```

This will check:
- ✅ Environment variables are set
- ✅ Twilio SDK is installed
- ✅ Database schema has required fields
- ✅ Source code functions are implemented
- ✅ Tests are in place

---

## Environment Setup

### Prerequisites
1. Active Twilio account with credentials:
   - `TWILIO_ACCOUNT_SID` (starts with `AC`)
   - `TWILIO_AUTH_TOKEN`

2. (Optional) Messaging Service for SMS:
   - `TWILIO_MESSAGING_SERVICE_SID` (starts with `MG`)

### Configuration

Create `.env` file in root directory:
```env
# Required
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# Optional (defaults to US)
TWILIO_NUMBER_COUNTRY_CODE=US

# Optional (for SMS/Voice handling)
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_SMS_WEBHOOK_URL=https://your-domain.com/webhooks/sms
TWILIO_VOICE_WEBHOOK_URL=https://your-domain.com/webhooks/voice
TWILIO_STATUS_CALLBACK_URL=https://your-domain.com/webhooks/status
```

---

## Manual Testing via API

### Step 0: Sign Up & Complete Step 2

**Create Account:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123"
  }'
```

Response:
```json
{
  "message": "User created successfully.",
  "user": {
    "id": "user-uuid",
    "email": "test@example.com",
    "onboarding_step": 1
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Save the `token` - you'll need it for all subsequent requests.

**Complete Step 2:**
```bash
curl -X POST http://localhost:3000/api/auth/onboarding/step2 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "company_name": "Acme Corp",
    "company_email": "john@acme.com",
    "company_type": "Service",
    "business_structure": "LLC"
  }'
```

---

### Step 1: Search Available Numbers

#### **Search by City** ✅

```bash
curl -X GET "http://localhost:3000/api/auth/onboarding/available-numbers?type=city&city=Washington" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response (5 numbers max):**
```json
{
  "type": "city",
  "country": "US",
  "numbers": [
    {
      "phone_number": "+12025551234",
      "friendly_name": "US/United States",
      "locality": "Washington",
      "region": "DC",
      "postal_code": "20001",
      "country": "US",
      "capabilities": {
        "voice": true,
        "sms": true,
        "mms": false
      },
      "type": "local",
      "area_code": "202"
    }
    // ... more numbers
  ],
  "count": 2
}
```

**Testing Checklist for City Search:**
- [ ] Response contains up to 5 numbers
- [ ] Each number has valid E.164 format (+country digits)
- [ ] Capabilities are present (voice, sms, mms)
- [ ] Area code is extracted correctly

**Try these cities:**
- `Washington` - DC (area code 202)
- `NewYork` - New York (area code 212)
- `SanFrancisco` - California (area code 415)
- `Chicago` - Illinois (area code 312)
- `Miami` - Florida (area code 305)

---

#### **Search by Area Code** ✅

```bash
curl -X GET "http://localhost:3000/api/auth/onboarding/available-numbers?type=area_code&area_code=202" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Testing Checklist for Area Code Search:**
- [ ] Valid 3-digit area codes work
- [ ] Non-3-digit area codes throw error
- [ ] Response contains numbers from that area code
- [ ] Letters/special chars in area code are sanitized

**Try these area codes:**
- `202` - Washington DC
- `212` - New York
- `415` - San Francisco
- `312` - Chicago
- `305` - Miami

---

#### **Search Toll-Free Numbers** ✅

```bash
curl -X GET "http://localhost:3000/api/auth/onboarding/available-numbers?type=toll_free" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "type": "toll_free",
  "country": "US",
  "numbers": [
    {
      "phone_number": "+18005551234",
      "type": "toll_free",
      // ... other fields
    }
  ],
  "count": 1
}
```

**Testing Checklist for Toll-Free Search:**
- [ ] Returns toll-free numbers (usually 1-800/1-888/1-877)
- [ ] Type is marked as "toll_free"
- [ ] Numbers have voice/SMS capabilities

---

### Step 2: Provision a Phone Number

Select one of the phone numbers from the search results and provision it.

```bash
curl -X POST http://localhost:3000/api/auth/onboarding/step3 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+12025551234",
    "search_type": "city"
  }'
```

**Expected Response (Success):**
```json
{
  "message": "AI business number provisioned.",
  "user": {
    "id": "user-uuid",
    "email": "test@example.com",
    "onboarding_step": 4
  },
  "business": {
    "id": "business-uuid",
    "ai_phone_number": "+12025551234",
    "dedicated_phone_number": "+12025551234",
    "ai_phone_country": "US",
    "ai_phone_area_code": "202",
    "twilio_phone_sid": "PNxxxxxxxxxxxx",
    "twilio_phone_friendly_name": "Acme Corp - +12025551234"
  },
  "ai_phone_number": "+12025551234",
  "twilio_phone_sid": "PNxxxxxxxxxxxx",
  "onboarding_step": 4
}
```

**Testing Checklist for Provisioning:**
- [ ] HTTP status is 200 (success)
- [ ] User is advanced to step 4
- [ ] Business has ai_phone_number set
- [ ] Twilio SID is returned
- [ ] Friendly name includes business name
- [ ] Area code is extracted correctly (202 from +1 202...)
- [ ] No password_hash in user response
- [ ] No internal_api_token in business response

---

## Error Testing

### Test 1: Invalid E.164 Format

```bash
curl -X POST http://localhost:3000/api/auth/onboarding/step3 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "2025551234",
    "search_type": "city"
  }'
```

**Expected Response (Error):**
```json
{
  "error": "phone_number must be a valid E.164 phone number."
}
```

**Testing:** ✅ Verify error message is clear and specific

---

### Test 2: Missing Required Fields

```bash
curl -X POST http://localhost:3000/api/auth/onboarding/step3 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "search_type": "city"
  }'
```

**Expected Response:**
```json
{
  "error": "phone_number is required."
}
```

**Testing:** ✅ Error messages guide user to correct issue

---

### Test 3: Invalid Area Code Format

```bash
curl -X GET "http://localhost:3000/api/auth/onboarding/available-numbers?type=area_code&area_code=12" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "error": "area_code must be a 3-digit code."
}
```

**Testing:** ✅ Input validation prevents invalid searches

---

### Test 4: No Available Numbers

```bash
curl -X GET "http://localhost:3000/api/auth/onboarding/available-numbers?type=city&city=ZZZInvalidCityZZZ" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "type": "city",
  "country": "US",
  "numbers": [],
  "count": 0
}
```

**Testing:** ✅ Returns empty list gracefully (no crash)

---

## Verification Checklist

### Phase 1: Code Structure ✅
- [ ] `getAvailableNumbers()` function exists
- [ ] `onboardingStep3()` function exists
- [ ] `getTwilioClient()` helper exists
- [ ] `normalizeE164Number()` helper exists
- [ ] `extractAreaCode()` helper exists
- [ ] `releaseIncomingPhoneNumber()` helper exists (for rollback)

### Phase 2: Configuration ✅
- [ ] TWILIO_ACCOUNT_SID is set
- [ ] TWILIO_AUTH_TOKEN is set
- [ ] Twilio SDK is installed (`npm list twilio`)
- [ ] Database migrations applied
- [ ] Environment variables loaded in env.js

### Phase 3: Unit Tests ✅
- [ ] Run: `npm test -- auth.onboarding-step3-audit.spec.js`
- [ ] All tests pass
- [ ] Error scenarios covered
- [ ] Transaction rollback tested

### Phase 4: Integration Tests ✅
- [ ] Search by city works
- [ ] Search by area code works
- [ ] Search toll-free works
- [ ] Provision number works
- [ ] User advanced to step 4
- [ ] Business record updated
- [ ] Error handling works

### Phase 5: Production Readiness ✅
- [ ] Rate limiting implemented (optional but recommended)
- [ ] Error monitoring configured
- [ ] Webhook endpoints documented
- [ ] Ops runbook created
- [ ] Rollback procedure documented

---

## Troubleshooting

### Issue: "Twilio SDK is not installed"

**Solution:**
```bash
npm install twilio
```

---

### Issue: "Twilio credentials are not configured"

**Solution:**
1. Create `.env` file in project root
2. Add `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`
3. Get credentials from [Twilio Console](https://console.twilio.com)

---

### Issue: "Unable to fetch available Twilio phone numbers"

**Possible Causes:**
- Twilio credentials are invalid
- Twilio API is down
- Network connectivity issue
- Exceeded Twilio rate limits

**Debugging:**
```bash
# Check logs
tail -f logs/*.log | grep -i twilio

# Test Twilio credentials manually
node -e "
  const twilio = require('twilio');
  const client = twilio('AC...', 'token...');
  client.api.accounts.list({ limit: 1 })
    .then(accounts => console.log('✅ Credentials valid'))
    .catch(err => console.error('❌', err.message));
"
```

---

### Issue: "Unable to provision the selected Twilio phone number"

**Possible Causes:**
- Phone number already taken by another account
- Twilio account doesn't have SMS/voice capability for that number
- Twilio API error

**Debugging:**
```bash
# Try a different search to get fresh numbers
# Then try provisioning again
```

---

### Issue: "This business already has a provisioned Twilio number"

**Explanation:** 
- You're trying to provision a different number to a business that already has one

**Solution:**
- Skip step 3: `POST /api/auth/onboarding/skip3`
- Or deprovision the existing number first (admin endpoint)

---

## Database Queries for Verification

### View Provisioned Numbers

```sql
SELECT 
  b.id,
  b.name,
  b.ai_phone_number,
  b.ai_phone_country,
  b.ai_phone_area_code,
  b.twilio_phone_sid,
  b.twilio_phone_friendly_name,
  u.email
FROM business b
LEFT JOIN "user" u ON b.owner_id = u.id
WHERE b.ai_phone_number IS NOT NULL
ORDER BY b.created_at DESC;
```

### Verify Field Updates

```sql
SELECT 
  ai_phone_number,
  dedicated_phone_number,
  ai_phone_country,
  ai_phone_area_code,
  twilio_phone_sid,
  twilio_phone_friendly_name
FROM business
WHERE id = 'YOUR_BUSINESS_ID';
```

---

## Performance Benchmarks

**Expected Latencies:**
- Search available numbers: 500-2000ms (Twilio API dependent)
- Provision number: 1000-3000ms (Twilio provisioning + DB)
- Extract area code: <1ms (local operation)

**If exceeding benchmarks:**
1. Check Twilio API status
2. Monitor database query performance
3. Consider caching available numbers (5-10 min TTL)

---

## Security Validation

### Checklist

- [ ] Phone numbers stored in E.164 format only
- [ ] E.164 format strictly validated on input
- [ ] No phone numbers exposed in API logs
- [ ] No Twilio SIDs/tokens exposed in responses
- [ ] Only authenticated users can access
- [ ] Database transactions are atomic
- [ ] Failed provisioning triggers rollback
- [ ] Error messages don't expose sensitive info

---

## Next Steps

1. ✅ Run audit script: `node scripts/audit-twilio-integration.js`
2. ✅ Run tests: `npm test -- auth.onboarding-step3-audit.spec.js`
3. ✅ Test manually with curl commands above
4. ✅ Monitor logs during testing
5. ✅ Deploy to staging for team testing
6. ✅ Set up production monitoring
7. ✅ Document ops runbook
8. ✅ Deploy to production

---

## Support

For issues or questions:
1. Check the [ONBOARDING_STEP3_AUDIT.md](ONBOARDING_STEP3_AUDIT.md) for technical details
2. Review test suite for examples
3. Check Twilio documentation: https://www.twilio.com/docs
4. Contact ops team with error logs
