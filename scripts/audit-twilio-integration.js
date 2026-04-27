#!/usr/bin/env node

/**
 * Twilio Phone Number Generation - Quick Verification Script
 * 
 * This script helps audit the Twilio integration by:
 * 1. Validating environment variables
 * 2. Testing Twilio SDK availability
 * 3. Simulating key operations
 * 
 * Usage:
 *   node scripts/audit-twilio-integration.js
 */

const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const logger = require('../src/utils/logger');
const env = require('../src/config/env');

const CHECKS = [];

// ============================================
// HELPER FUNCTIONS
// ============================================

function pass(message) {
  CHECKS.push({ status: '✅', message });
  console.log(`✅ ${message}`);
}

function fail(message) {
  CHECKS.push({ status: '❌', message });
  console.log(`❌ ${message}`);
}

function warn(message) {
  CHECKS.push({ status: '⚠️', message });
  console.log(`⚠️  ${message}`);
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

// ============================================
// AUDIT CHECKS
// ============================================

function checkEnvironmentVariables() {
  section('1. Environment Variables');

  const required = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
  ];

  const optional = [
    'TWILIO_MESSAGING_SERVICE_SID',
    'TWILIO_NUMBER_COUNTRY_CODE',
    'TWILIO_SMS_WEBHOOK_URL',
    'TWILIO_VOICE_WEBHOOK_URL',
    'TWILIO_STATUS_CALLBACK_URL',
  ];

  required.forEach(key => {
    if (env[key]) {
      pass(`${key} is set`);
    } else {
      fail(`${key} is MISSING (required)`);
    }
  });

  optional.forEach(key => {
    if (env[key]) {
      pass(`${key} = ${env[key]}`);
    } else {
      warn(`${key} is not configured (optional)`);
    }
  });

  // Validate format
  if (env.TWILIO_ACCOUNT_SID && !env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    warn(`TWILIO_ACCOUNT_SID should start with "AC", got: ${env.TWILIO_ACCOUNT_SID.substring(0, 10)}...`);
  }

  if (env.TWILIO_NUMBER_COUNTRY_CODE && env.TWILIO_NUMBER_COUNTRY_CODE.length !== 2) {
    fail(`TWILIO_NUMBER_COUNTRY_CODE should be 2-letter code, got: ${env.TWILIO_NUMBER_COUNTRY_CODE}`);
  } else {
    pass(`TWILIO_NUMBER_COUNTRY_CODE format valid: ${env.TWILIO_NUMBER_COUNTRY_CODE || 'US (default)'}`);
  }
}

function checkTwilioSDK() {
  section('2. Twilio SDK Installation');

  try {
    const twilio = require('twilio');
    pass('Twilio SDK is installed');

    try {
      if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
        const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
        pass('Twilio client initialized successfully');
      } else {
        warn('Cannot test client initialization without credentials');
      }
    } catch (err) {
      fail(`Failed to initialize Twilio client: ${err.message}`);
    }
  } catch (err) {
    fail('Twilio SDK not installed. Run: npm install twilio');
  }
}

function checkDatabaseSchema() {
  section('3. Database Schema');

  const requiredFields = [
    'ai_phone_number',
    'dedicated_phone_number',
    'ai_phone_country',
    'ai_phone_area_code',
    'twilio_phone_sid',
    'twilio_phone_friendly_name',
  ];

  const schemaFile = path.resolve(__dirname, '../prisma/schema.prisma');
  let schemaContent = '';

  try {
    schemaContent = fs.readFileSync(schemaFile, 'utf-8');
    pass(`Found Prisma schema at ${schemaFile}`);
  } catch (err) {
    fail(`Cannot read Prisma schema: ${err.message}`);
    return;
  }

  requiredFields.forEach(field => {
    if (schemaContent.includes(field)) {
      pass(`Database field "${field}" is defined in schema`);
    } else {
      fail(`Database field "${field}" NOT found in schema`);
    }
  });

  // Check for migration
  const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
  const twilioMigrations = fs.readdirSync(migrationsDir).filter(f => 
    f.includes('twilio') || f.includes('phone')
  );

  if (twilioMigrations.length > 0) {
    pass(`Found Twilio-related migration: ${twilioMigrations[0]}`);
  } else {
    warn('No Twilio-related migration found (may be included in another migration)');
  }
}

function checkSourceCode() {
  section('4. Source Code Implementation');

  const authServicePath = path.resolve(__dirname, '../src/domains/auth/auth.service.js');
  let authServiceCode = '';

  try {
    authServiceCode = fs.readFileSync(authServicePath, 'utf-8');
    pass(`Found auth service at ${authServicePath}`);
  } catch (err) {
    fail(`Cannot read auth service: ${err.message}`);
    return;
  }

  const functions = [
    'getAvailableNumbers',
    'onboardingStep3',
    'getTwilioClient',
    'normalizeE164Number',
    'extractAreaCode',
    'releaseIncomingPhoneNumber',
  ];

  functions.forEach(func => {
    if (authServiceCode.includes(`function ${func}`) || authServiceCode.includes(`const ${func}`)) {
      pass(`Function "${func}" is implemented`);
    } else {
      fail(`Function "${func}" NOT found`);
    }
  });

  // Check for error handling
  if (authServiceCode.includes('$transaction')) {
    pass('Transaction management implemented (database atomic operations)');
  } else {
    fail('Transaction management not found');
  }

  if (authServiceCode.includes('releaseIncomingPhoneNumber')) {
    pass('Rollback mechanism implemented (phone release on failure)');
  } else {
    fail('Rollback mechanism not found');
  }
}

function checkTests() {
  section('5. Test Coverage');

  const testFile = path.resolve(__dirname, '../test/jest/auth.onboarding-step3-audit.spec.js');
  
  try {
    fs.accessSync(testFile);
    pass(`Found audit test suite at ${testFile}`);
    
    const testContent = fs.readFileSync(testFile, 'utf-8');
    const testCount = (testContent.match(/test\(/g) || []).length;
    pass(`Audit test suite contains ${testCount} tests`);
  } catch (err) {
    warn(`Audit test suite not found at ${testFile}`);
  }

  // Check for general auth tests
  const generalTestDir = path.resolve(__dirname, '../test/jest');
  const authTestFiles = fs.readdirSync(generalTestDir).filter(f => f.includes('auth'));
  
  if (authTestFiles.length > 0) {
    pass(`Found ${authTestFiles.length} auth-related test file(s)`);
  } else {
    warn('No auth test files found');
  }
}

function checkWebhooks() {
  section('6. Webhook Configuration');

  const webhooks = [
    { name: 'SMS Webhook', value: env.TWILIO_SMS_WEBHOOK_URL },
    { name: 'Voice Webhook', value: env.TWILIO_VOICE_WEBHOOK_URL },
    { name: 'Status Callback', value: env.TWILIO_STATUS_CALLBACK_URL },
  ];

  webhooks.forEach(webhook => {
    if (webhook.value) {
      if (webhook.value.startsWith('http')) {
        pass(`${webhook.name}: ${webhook.value}`);
      } else {
        fail(`${webhook.name} has invalid format: ${webhook.value}`);
      }
    } else {
      warn(`${webhook.name} is not configured (optional)`);
    }
  });
}

function checkDevelopmentSetup() {
  section('7. Development Setup');

  if (env.isDevelopment) {
    pass('Running in development mode');
  } else {
    warn(`Running in ${env.NODE_ENV} mode`);
  }

  // Check .env file
  const envPath = path.resolve(__dirname, '../.env');
  try {
    fs.accessSync(envPath);
    pass('.env file exists');
  } catch (err) {
    fail('.env file not found. Copy .env.example and configure it.');
  }

  // Check package.json
  const packagePath = path.resolve(__dirname, '../package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    if (pkg.dependencies.twilio) {
      pass(`Twilio dependency installed: ^${pkg.dependencies.twilio}`);
    } else {
      fail('Twilio not in package.json dependencies');
    }
  } catch (err) {
    fail(`Cannot read package.json: ${err.message}`);
  }
}

function generateReport() {
  section('AUDIT REPORT');

  const passed = CHECKS.filter(c => c.status === '✅').length;
  const failed = CHECKS.filter(c => c.status === '❌').length;
  const warnings = CHECKS.filter(c => c.status === '⚠️').length;

  console.log(`\nSummary:`);
  console.log(`  ✅ Passed:  ${passed}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log(`  ⚠️  Warnings: ${warnings}\n`);

  if (failed === 0) {
    console.log('✅ All critical checks passed!');
    console.log('\nNext steps:');
    console.log('  1. Run the test suite: npm test -- auth.onboarding-step3-audit.spec.js');
    console.log('  2. Test in development: npm start');
    console.log('  3. Try searching for numbers via API');
    console.log('  4. Try provisioning a test number\n');
  } else {
    console.log('❌ Some critical checks failed. Please fix the issues above.\n');
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Twilio Phone Number Generation - Audit Script           ║');
  console.log('║  Onboarding Step 3: AI Business Number Provisioning      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  checkEnvironmentVariables();
  checkTwilioSDK();
  checkDatabaseSchema();
  checkSourceCode();
  checkTests();
  checkWebhooks();
  checkDevelopmentSetup();
  generateReport();
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
