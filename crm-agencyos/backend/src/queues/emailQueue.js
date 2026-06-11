// backend/src/queues/emailQueue.js
const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const emailQueue = new Queue('email-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 200 },
    removeOnFail:     { count: 100 },
  },
});

/**
 * Push an email job onto the Redis queue.
 * Returns immediately — the worker picks it up asynchronously.
 *
 * @param {string} recipientEmail   - destination address
 * @param {string} emailType        - one of the EMAIL_TYPES constants
 * @param {object} templateData     - payload passed verbatim to the template
 * @returns {string}                - BullMQ job ID
 */
const addEmailToQueue = async (recipientEmail, emailType, templateData = {}, triggeredBy = null, cc = null, leadId = null) => {
  const job = await emailQueue.add(emailType, {
    recipientEmail,
    emailType,
    templateData,
    triggeredBy,           // userId of the CRM user who triggered this send
    cc: cc && cc !== recipientEmail ? cc : null,   // company-wide CC (skipped if same address)
    leadId: leadId ? String(leadId) : null,        // linked lead for email-log persistence
    queuedAt: new Date().toISOString(),
  });
  return job.id;
};

// Named constants so callers never use raw strings
const EMAIL_TYPES = {
  WELCOME:          'WELCOME_EMAIL',
  LEAD_WON:         'LEAD_WON',
  LEAD_ASSIGNED:    'LEAD_ASSIGNED',
  LEAD_MENTIONED:   'LEAD_MENTIONED',
  TASK_ASSIGNED:    'TASK_ASSIGNMENT',
  OUTBOUND_EMAIL:   'OUTBOUND_EMAIL',
  INVOICE_REMINDER: 'INVOICE_REMINDER',
};

module.exports = { emailQueue, addEmailToQueue, EMAIL_TYPES };
