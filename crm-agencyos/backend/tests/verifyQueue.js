// backend/src/verifyQueue.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { addEmailToQueue, EMAIL_TYPES } = require('../src/queues/emailQueue');

console.log('Testing BullMQ enqueuing with Redis settings:');
console.log('Host:', process.env.REDIS_HOST || '127.0.0.1');
console.log('Port:', process.env.REDIS_PORT || '6379');

async function run() {
  try {
    const jobId = await addEmailToQueue(
      'test@example.com',
      EMAIL_TYPES.OUTBOUND_EMAIL,
      {
        senderName:  'Test Sender',
        companyName: 'Test Company',
        subject:     'Verification Test',
        bodyText:    'Hello, this is a test enqueued via the verifyQueue script.',
      },
      '664f7cbe804d9c720c74f555', // fake admin user id
      null,
      '664f7cbe804d9c720c74f888'  // fake lead id
    );
    console.log('✅ JOB ENQUEUED SUCCESSFULLY! Job ID is:', jobId);
  } catch (err) {
    console.error('❌ BULLMQ ENQUEUE FAILED:', err);
  }
  process.exit(0);
}

run();
