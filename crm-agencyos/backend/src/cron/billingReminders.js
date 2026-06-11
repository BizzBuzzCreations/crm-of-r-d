'use strict';

const cron = require('node-cron');
const { Invoice }       = require('../models/Invoice');
const { addEmailToQueue, EMAIL_TYPES } = require('../queues/emailQueue');

// Runs daily at 08:00 AM
// - Marks overdue invoices
// - Sends "due in 7 days" reminders (once per invoice)
// - Sends overdue reminders (once per invoice, re-sends weekly)

function startBillingCron() {
  cron.schedule('0 8 * * *', runReminders, { timezone: 'Asia/Kolkata' });
  console.log('✅ Billing reminders cron scheduled (daily 08:00 IST)');
}

async function runReminders() {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const today    = new Date(todayStr + 'T00:00:00');
    const in7Days  = new Date(today); in7Days.setDate(in7Days.getDate() + 7);
    const in7DayStr = in7Days.toISOString().split('T')[0];
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    // ── 1. Auto-mark overdue ──────────────────────────────────
    await Invoice.updateMany(
      {
        isDeleted: { $ne: true },
        status:    { $in: ['sent', 'partially_paid'] },
        dueDate:   { $lt: todayStr, $ne: '' },
      },
      { status: 'overdue' }
    );

    // ── 2. Due-in-7-days reminders ────────────────────────────
    const dueSoon = await Invoice.find({
      isDeleted:  { $ne: true },
      status:     { $in: ['sent', 'partially_paid'] },
      dueDate:    in7DayStr,
    }).populate('clientId', 'name email contact billingProfile').lean();

    for (const inv of dueSoon) {
      const email = inv.clientId?.email;
      if (!email) continue;
      await addEmailToQueue(email, EMAIL_TYPES.INVOICE_REMINDER, {
        clientName:    inv.clientId?.name  || 'Client',
        contactName:   inv.clientId?.contact || inv.clientId?.name || 'there',
        invoiceNumber: `INV-${inv.invoiceNumber}`,
        dueDate:       inv.dueDate,
        balanceDue:    inv.balanceDue,
        currency:      inv.currency || 'INR',
        portalUrl:     `${clientUrl}/portal`,
        type:          'due_soon',
      });
    }

    // ── 3. Overdue reminders (resend weekly) ──────────────────
    const oneWeekAgo = new Date(today); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const overdue = await Invoice.find({
      isDeleted:          { $ne: true },
      status:             'overdue',
      $or: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { $lt: oneWeekAgo } },
      ],
    }).populate('clientId', 'name email contact').lean();

    for (const inv of overdue) {
      const email = inv.clientId?.email;
      if (!email) continue;
      const daysLate = inv.dueDate
        ? Math.floor((today - new Date(inv.dueDate + 'T00:00:00')) / 86400000)
        : 0;
      await addEmailToQueue(email, EMAIL_TYPES.INVOICE_REMINDER, {
        clientName:    inv.clientId?.name    || 'Client',
        contactName:   inv.clientId?.contact || inv.clientId?.name || 'there',
        invoiceNumber: `INV-${inv.invoiceNumber}`,
        dueDate:       inv.dueDate,
        balanceDue:    inv.balanceDue,
        currency:      inv.currency || 'INR',
        daysLate,
        portalUrl:     `${clientUrl}/portal`,
        type:          'overdue',
      });
      await Invoice.findByIdAndUpdate(inv._id, { lastReminderSentAt: new Date() });
    }

    console.log(`[BillingCron] due-soon=${dueSoon.length}, overdue-reminded=${overdue.length}`);
  } catch (err) {
    console.error('[BillingCron] Error:', err.message);
  }
}

module.exports = { startBillingCron, runReminders };
