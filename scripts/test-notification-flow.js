#!/usr/bin/env node

/**
 * Test script for Twilio SMS notification flow
 * 
 * Usage:
 *   node scripts/test-notification-flow.js
 * 
 * Requires environment variables:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - TEST_MERCHANT_ID (optional, will use first merchant if not provided)
 *   - TEST_CONSUMER_PHONE (optional, will create test consumer if not provided)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_KEY ? '✓' : '✗');
  console.error('\nSet these in your .env file or export them before running.');
  process.exit(1);
}

const TEST_MERCHANT_ID = process.env.TEST_MERCHANT_ID;
const TEST_CONSUMER_PHONE = process.env.TEST_CONSUMER_PHONE || '+15165879844'; // Default test number

async function testNotificationFlow() {
  console.log('🧪 Testing Twilio SMS Notification Flow\n');
  console.log('Configuration:');
  console.log('  Supabase URL:', SUPABASE_URL);
  console.log('  Test Consumer Phone:', TEST_CONSUMER_PHONE);
  console.log('  Merchant ID:', TEST_MERCHANT_ID || '(will auto-detect)');
  console.log('');

  try {
    // Step 1: Get or create merchant
    console.log('📋 Step 1: Setting up merchant...');
    const merchantId = await getOrCreateMerchant();
    console.log('   ✓ Merchant ID:', merchantId);
    console.log('');

    // Step 2: Get or create consumer
    console.log('👤 Step 2: Setting up consumer...');
    const consumerId = await getOrCreateConsumer(merchantId);
    console.log('   ✓ Consumer ID:', consumerId);
    console.log('');

    // Step 3: Create notify request
    console.log('🔔 Step 3: Creating notify request...');
    const notifyRequestId = await createNotifyRequest(merchantId, consumerId);
    console.log('   ✓ Notify Request ID:', notifyRequestId);
    console.log('');

    // Step 4: Create test slot
    console.log('📅 Step 4: Creating test slot...');
    const slotId = await createTestSlot(merchantId);
    console.log('   ✓ Slot ID:', slotId);
    console.log('');

    // Step 5: Trigger notifications
    console.log('📤 Step 5: Triggering notifications...');
    const result = await triggerNotifications(slotId, merchantId);
    console.log('   ✓ Notifications triggered');
    console.log('   Result:', JSON.stringify(result, null, 2));
    console.log('');

    // Step 6: Verify notification record
    console.log('✅ Step 6: Verifying notification record...');
    const notification = await verifyNotification(slotId, consumerId);
    if (notification) {
      console.log('   ✓ Notification record found:', notification.id);
      console.log('   Status:', notification.status);
    } else {
      console.log('   ⚠️  No notification record found (SMS may have failed)');
    }
    console.log('');

    console.log('🎉 Test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Check Twilio console for sent messages');
    console.log('2. Check Supabase function logs:');
    console.log('   supabase functions logs notify-consumers');
    console.log('   supabase functions logs send-sms');
    console.log('3. Verify SMS was received on test phone');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

async function getOrCreateMerchant() {
  if (TEST_MERCHANT_ID) {
    return TEST_MERCHANT_ID;
  }

  // Get first merchant from profiles
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch merchant: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.length === 0) {
    throw new Error('No merchants found. Please create a merchant profile first.');
  }

  return data[0].id;
}

async function getOrCreateConsumer(merchantId) {
  // Check if consumer exists
  const checkResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/consumers?phone=eq.${encodeURIComponent(TEST_CONSUMER_PHONE)}&select=id&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (checkResponse.ok) {
    const existing = await checkResponse.json();
    if (existing.length > 0) {
      return existing[0].id;
    }
  }

  // Create new consumer
  const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/consumers`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      name: 'Test Consumer',
      phone: TEST_CONSUMER_PHONE,
      saved_info: true,
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create consumer: ${error}`);
  }

  const data = await createResponse.json();
  return Array.isArray(data) ? data[0].id : data.id;
}

async function createNotifyRequest(merchantId, consumerId) {
  // Check if notify request exists
  const checkResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/notify_requests?merchant_id=eq.${merchantId}&consumer_id=eq.${consumerId}&select=id&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (checkResponse.ok) {
    const existing = await checkResponse.json();
    if (existing.length > 0) {
      return existing[0].id;
    }
  }

  // Create new notify request
  const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/notify_requests`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      merchant_id: merchantId,
      consumer_id: consumerId,
      time_range: 'anytime', // Match any slot
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create notify request: ${error}`);
  }

  const data = await createResponse.json();
  return Array.isArray(data) ? data[0].id : data.id;
}

async function createTestSlot(merchantId) {
  // Create a slot for tomorrow at 2 PM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0); // 2 PM

  const startTime = tomorrow.toISOString();
  const endTime = new Date(tomorrow.getTime() + 30 * 60000).toISOString(); // 30 minutes later

  const response = await fetch(`${SUPABASE_URL}/rest/v1/slots`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      merchant_id: merchantId,
      start_time: startTime,
      end_time: endTime,
      status: 'open',
      appointment_type: 'Test Appointment',
      created_via: 'dashboard',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create slot: ${error}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data[0].id : data.id;
}

async function triggerNotifications(slotId, merchantId) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/notify-consumers`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      slotId: slotId,
      merchantId: merchantId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to trigger notifications: ${error}`);
  }

  return await response.json();
}

async function verifyNotification(slotId, consumerId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/notifications?slot_id=eq.${slotId}&consumer_id=eq.${consumerId}&select=id,status,sent_at&order=sent_at.desc&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.length > 0 ? data[0] : null;
}

// Run the test
testNotificationFlow().catch(console.error);


