// backend/src/workers/emailWorker.js
// ── Standalone daemon — run via: npm run worker  OR  pm2 start ──────────────
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { Worker } = require('bullmq');
const nodemailer  = require('nodemailer');
const mongoose    = require('mongoose');
const EmailLog    = require('../models/EmailLog');

// ── MongoDB connection (worker-local, non-blocking startup) ──────────────────
mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 })
  .then(() => console.log('✅ MongoDB connected (email worker)'))
  .catch((e) => console.error('⚠️  MongoDB connection failed — email logs will not be saved:', e.message));

// ── Startup config ───────────────────────────────────────────────────────────
const cfg = {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  smtp: {
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user:   process.env.SMTP_USER,
    pass:   (process.env.SMTP_PASS || '').replace(/\s/g, ''), // strip display spaces from App Password
  },
  from:     `"${process.env.EMAIL_FROM_NAME || 'BizzBuzz CRM'}" <${process.env.EMAIL_FROM}>`,
  replyTo:  process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM,
  company:  process.env.EMAIL_FROM_NAME || 'BizzBuzz CRM',
  // Receives a CC copy of every LEAD_ASSIGNED / LEAD_WON notification.
  // Set COMPANY_NOTIFICATION_EMAIL in .env; falls back to EMAIL_FROM.
  companyNotificationEmail: process.env.COMPANY_NOTIFICATION_EMAIL || process.env.EMAIL_FROM,
};

console.log('\n══════════════════════════════════════════════════');
console.log('  BizzBuzz CRM — Email Worker v2.0');
console.log('══════════════════════════════════════════════════');
console.log(`  Redis   : ${cfg.redis.host}:${cfg.redis.port}`);
console.log(`  SMTP    : ${cfg.smtp.host}:${cfg.smtp.port}  secure=${cfg.smtp.secure}`);
console.log(`  User    : ${cfg.smtp.user || '⚠ SMTP_USER not set'}`);
console.log(`  Pass    : ${cfg.smtp.pass ? `${'*'.repeat(Math.min(cfg.smtp.pass.length, 8))} (${cfg.smtp.pass.length} chars)` : '⚠ SMTP_PASS not set'}`);
console.log(`  From    : ${cfg.from}`);
console.log('══════════════════════════════════════════════════\n');

// ── Nodemailer transport ─────────────────────────────────────────────────────
// pool:true reuses SMTP connections — reduces auth overhead and improves
// deliverability by lowering the "new connection per message" pattern that
// spam filters treat as suspicious.
const transporter = nodemailer.createTransport({
  host:   cfg.smtp.host,
  port:   cfg.smtp.port,
  secure: cfg.smtp.secure,
  auth:   { user: cfg.smtp.user, pass: cfg.smtp.pass },
  pool:   true,
  maxConnections: 3,
  maxMessages:    100,
  rateDelta:      1000,   // max 5 messages per second
  rateLimit:      5,
  tls: {
    rejectUnauthorized: true,   // enforce valid TLS cert
    minVersion:         'TLSv1.2',
  },
  // sendmailOptions is not used here, but socketTimeout prevents hanging
  socketTimeout: 10000,
  greetingTimeout: 10000,
  connectionTimeout: 10000,
});

transporter.verify((err, _ok) => {
  if (err) {
    console.error('❌ SMTP CONNECTION FAILED');
    console.error('   Code    :', err.code   || 'n/a');
    console.error('   Message :', err.message);
    if (err.response) console.error('   Server  :', err.response);
    console.error('\n   ── Troubleshooting ──────────────────────────────');
    console.error('   1. Gmail: enable 2FA → App Passwords → generate 16-char token');
    console.error('      https://myaccount.google.com/apppasswords');
    console.error('   2. SMTP_USER and EMAIL_FROM must be the same address.');
    console.error('   3. SMTP_PORT=587 + SMTP_SECURE=false → STARTTLS (recommended)');
    console.error('      SMTP_PORT=465 + SMTP_SECURE=true  → SSL/TLS\n');
  } else {
    console.log('✅ SMTP connection verified — ready to send emails');
    console.log(`   Authenticated as: ${cfg.smtp.user}\n`);
  }
});

// ── Anti-spam headers added to every message ─────────────────────────────────
// These tell receiving servers and spam filters this is legitimate
// transactional mail, not bulk unsolicited mail.
const spamSafeHeaders = (recipientEmail) => ({
  'X-Priority':     '3',          // 1=High 3=Normal 5=Low — Normal avoids spam
  'X-Mailer':       'BizzBuzz CRM Notification Service',
  'Importance':     'Normal',
  // List-Unsubscribe signals that this sender respects opt-outs —
  // Gmail's spam algorithms strongly reward its presence.
  'List-Unsubscribe':       `<mailto:${cfg.smtp.user}?subject=unsubscribe>`,
  'List-Unsubscribe-Post':  'List-Unsubscribe=One-Click',
  // Precedence tells servers this is automated transactional mail,
  // not a bulk marketing blast — affects filtering differently.
  'Precedence': 'transactional',
  'X-Auto-Response-Suppress': 'OOF',
});

// ── HTML email wrapper ────────────────────────────────────────────────────────
// Deliverability notes applied here:
//   • role="presentation" on layout tables (screen readers + filters)
//   • Explicit Content-Type meta tag
//   • MSO conditional for Outlook
//   • Unsubscribe + physical address in footer (CAN-SPAM §5)
//   • max-width 600px in a wrapper table (Outlook-safe, not CSS width)
const wrapHtml = (title, bodyHtml) => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--<![endif]-->
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-spacing: 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td { padding: 0; }
    img { border: 0; -ms-interpolation-mode: bicubic; }
    a { color: #4f46e5; }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 36px;">
              <p style="margin:0;font-size:11px;font-weight:700;color:rgba(255,255,255,0.65);letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">
                ${cfg.company}
              </p>
              <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;font-family:Arial,sans-serif;line-height:1.3;">
                ${title}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;font-family:'Segoe UI',Arial,sans-serif;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer — CAN-SPAM §5 requires physical address + unsubscribe mechanism -->
          <tr>
            <td style="padding:20px 36px 28px;border-top:1px solid #e2e8f0;background-color:#f8fafc;">
              <p style="margin:0;font-size:10px;color:#cbd5e1;text-align:center;font-family:Arial,sans-serif;">
                BizzBuzz Creations · Digital Agency CRM Platform<br />
                To stop receiving these emails, reply with subject <strong>unsubscribe</strong>.
              </p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

// ── Plain-text generator ──────────────────────────────────────────────────────
// Spam filters heavily penalise HTML-only emails. Every message MUST
// include a text/plain part — it is the single biggest deliverability fix.
const stripToPlain = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

// ── Template builders ────────────────────────────────────────────────────────
// Each template returns { subject, html, text }.
// The `text` field is the plain-text fallback — required for deliverability.
const templates = {

  LEAD_WON: ({ companyName, contactPerson, dealValue, assigneeName, closedBy, clientUrl }) => {
    const subject = `Deal Won: ${companyName} — ₹${Number(dealValue || 0).toLocaleString('en-IN')}`;
    const fmtValue = `₹${Number(dealValue || 0).toLocaleString('en-IN')}`;
    const url = clientUrl || `${process.env.CLIENT_URL}/leads`;

    const html = wrapHtml('Deal Closed — Congratulations!', `
      <p style="font-size:15px;color:#334155;margin:0 0 20px;font-family:Arial,sans-serif;">
        Outstanding work, <strong>${assigneeName || 'Team'}</strong>! The deal is closed.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
        <tr><td style="padding:20px 24px;">
          <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size:13.5px;color:#475569;font-family:Arial,sans-serif;">
            <tr><td width="38%" style="font-weight:700;color:#0f172a;">Company</td><td>${companyName}</td></tr>
            <tr style="background-color:#f1f5f9;"><td style="font-weight:700;color:#0f172a;">Contact</td><td>${contactPerson}</td></tr>
            <tr><td style="font-weight:700;color:#0f172a;">Deal Value</td><td><strong style="font-size:16px;color:#10b981;">${fmtValue}</strong></td></tr>
            <tr style="background-color:#f1f5f9;"><td style="font-weight:700;color:#0f172a;">Closed By</td><td>${closedBy || 'System'}</td></tr>
          </table>
        </td></tr>
      </table>
      <p style="font-size:13px;color:#64748b;margin:0 0 20px;font-family:Arial,sans-serif;">
        A <strong>Client Profile</strong> and <strong>Delivery Workspace</strong> have been automatically provisioned.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td style="border-radius:8px;background-color:#4f46e5;">
          <a href="${url}" style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:13.5px;font-weight:700;color:#ffffff;text-decoration:none;">View Leads Pipeline</a>
        </td></tr>
      </table>`);

    const text = [
      `DEAL CLOSED — Congratulations, ${assigneeName || 'Team'}!`,
      '',
      `Company    : ${companyName}`,
      `Contact    : ${contactPerson}`,
      `Deal Value : ${fmtValue}`,
      `Closed By  : ${closedBy || 'System'}`,
      '',
      'A Client Profile and Delivery Workspace have been automatically provisioned.',
      '',
      `View Pipeline: ${url}`,
    ].join('\n');

    return { subject, html, text };
  },

  LEAD_ASSIGNED: ({ assigneeName, assignerName, companyName, contactPerson, dealValue, status, leadsUrl }) => {
    const subject = `Lead Assigned to You: ${companyName}`;
    const fmtValue = `₹${Number(dealValue || 0).toLocaleString('en-IN')}`;
    const url = leadsUrl || `${process.env.CLIENT_URL}/leads`;

    const html = wrapHtml('Lead Assigned to You', `
      <p style="font-size:15px;color:#334155;margin:0 0 20px;font-family:Arial,sans-serif;">
        Hi <strong>${assigneeName}</strong>,<br />
        <strong>${assignerName || 'A manager'}</strong> assigned you a new B2B sales lead.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
        <tr><td style="padding:20px 24px;">
          <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size:13.5px;color:#475569;font-family:Arial,sans-serif;">
            <tr><td width="38%" style="font-weight:700;color:#0f172a;">Company</td><td>${companyName}</td></tr>
            <tr style="background-color:#f1f5f9;"><td style="font-weight:700;color:#0f172a;">Contact</td><td>${contactPerson}</td></tr>
            <tr><td style="font-weight:700;color:#0f172a;">Deal Value</td><td><strong style="color:#4f46e5;">${fmtValue}</strong></td></tr>
            <tr style="background-color:#f1f5f9;"><td style="font-weight:700;color:#0f172a;">Stage</td><td>${status || 'New Lead'}</td></tr>
          </table>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td style="border-radius:8px;background-color:#4f46e5;">
          <a href="${url}" style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:13.5px;font-weight:700;color:#ffffff;text-decoration:none;">Open Lead in CRM</a>
        </td></tr>
      </table>`);

    const text = [
      `Hi ${assigneeName},`,
      '',
      `${assignerName || 'A manager'} assigned you a new B2B sales lead.`,
      '',
      `Company    : ${companyName}`,
      `Contact    : ${contactPerson}`,
      `Deal Value : ${fmtValue}`,
      `Stage      : ${status || 'New Lead'}`,
      '',
      `Open in CRM: ${url}`,
    ].join('\n');

    return { subject, html, text };
  },

  LEAD_MENTIONED: ({ mentionedName, authorName, companyName, noteExcerpt, leadsUrl }) => {
    const subject = `${authorName} mentioned you in a lead note`;
    const url = leadsUrl || `${process.env.CLIENT_URL}/leads`;

    const html = wrapHtml('You Were Mentioned', `
      <p style="font-size:15px;color:#334155;margin:0 0 20px;font-family:Arial,sans-serif;">
        Hi <strong>${mentionedName}</strong>,<br />
        <strong>${authorName}</strong> tagged you in a note on <strong>${companyName}</strong>.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border-left:4px solid #6366f1;background-color:#f5f3ff;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <tr><td style="padding:14px 18px;">
          <p style="margin:0;font-size:13.5px;color:#4c1d95;font-style:italic;font-family:Arial,sans-serif;">"${noteExcerpt}..."</p>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td style="border-radius:8px;background-color:#6366f1;">
          <a href="${url}" style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:13.5px;font-weight:700;color:#ffffff;text-decoration:none;">View Lead Timeline</a>
        </td></tr>
      </table>`);

    const text = [
      `Hi ${mentionedName},`,
      '',
      `${authorName} tagged you in a note on the lead "${companyName}".`,
      '',
      `Note: "${noteExcerpt}..."`,
      '',
      `View Timeline: ${url}`,
    ].join('\n');

    return { subject, html, text };
  },

  WELCOME_EMAIL: ({ userName, loginUrl }) => {
    const subject = `Welcome to BizzBuzz CRM, ${userName}`;
    const url = loginUrl || `${process.env.CLIENT_URL}/login`;

    const html = wrapHtml(`Welcome, ${userName}!`, `
      <p style="font-size:15px;color:#334155;margin:0 0 16px;font-family:Arial,sans-serif;">
        Your account has been created on the BizzBuzz CRM workspace.
      </p>
      <p style="font-size:13px;color:#64748b;margin:0 0 24px;font-family:Arial,sans-serif;">
        Sign in using your registered email and the password provided by your administrator.
        You can change your password from Profile Settings after logging in.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td style="border-radius:8px;background-color:#4f46e5;">
          <a href="${url}" style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:13.5px;font-weight:700;color:#ffffff;text-decoration:none;">Log In to BizzBuzz CRM</a>
        </td></tr>
      </table>`);

    const text = [
      `Welcome, ${userName}!`,
      '',
      'Your account has been created on the BizzBuzz CRM workspace.',
      'Sign in using your registered email and the password provided by your administrator.',
      '',
      `Log in here: ${url}`,
    ].join('\n');

    return { subject, html, text };
  },

  OUTBOUND_EMAIL: ({ senderName, companyName, subject, bodyText }) => {
    const safeBody = (bodyText || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');

    const html = wrapHtml(subject, `
      <p style="font-size:12px;color:#94a3b8;margin:0 0 20px;padding:8px 12px;background-color:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;font-family:Arial,sans-serif;">
        Sent via ${cfg.company} by <strong style="color:#475569;">${senderName || 'Your CRM Rep'}</strong>
        &nbsp;&middot;&nbsp; Regarding: <strong style="color:#475569;">${companyName}</strong>
      </p>
      <div style="font-size:14px;color:#1e293b;line-height:1.7;font-family:Arial,sans-serif;">
        ${safeBody}
      </div>`);

    const text = [
      `Sent via ${cfg.company} by ${senderName || 'Your CRM Rep'} — Regarding: ${companyName}`,
      '',
      '─────────────────────────────────',
      '',
      bodyText || '',
    ].join('\n');

    return { subject, html, text };
  },

  TASK_ASSIGNMENT: ({ assigneeName, assignerName, taskTitle, projectName, dueDate, tasksUrl }) => {
    const subject = `Task Assigned: ${taskTitle}`;
    const fmtDate = dueDate
      ? new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'No due date';
    const url = tasksUrl || `${process.env.CLIENT_URL}/tasks`;

    const html = wrapHtml('Task Assigned to You', `
      <p style="font-size:15px;color:#334155;margin:0 0 20px;font-family:Arial,sans-serif;">
        Hi <strong>${assigneeName}</strong>,<br />
        <strong>${assignerName || 'A manager'}</strong> assigned you a task.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
        <tr><td style="padding:20px 24px;">
          <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size:13.5px;color:#475569;font-family:Arial,sans-serif;">
            <tr><td width="38%" style="font-weight:700;color:#0f172a;">Task</td><td>${taskTitle}</td></tr>
            <tr style="background-color:#f1f5f9;"><td style="font-weight:700;color:#0f172a;">Project</td><td>${projectName || '—'}</td></tr>
            <tr><td style="font-weight:700;color:#0f172a;">Due Date</td><td>${fmtDate}</td></tr>
          </table>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td style="border-radius:8px;background-color:#4f46e5;">
          <a href="${url}" style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:13.5px;font-weight:700;color:#ffffff;text-decoration:none;">View Task Board</a>
        </td></tr>
      </table>`);

    const text = [
      `Hi ${assigneeName},`,
      '',
      `${assignerName || 'A manager'} assigned you a task.`,
      '',
      `Task     : ${taskTitle}`,
      `Project  : ${projectName || '—'}`,
      `Due Date : ${fmtDate}`,
      '',
      `View Board: ${url}`,
    ].join('\n');

    return { subject, html, text };
  },
};

// ── Log helpers ──────────────────────────────────────────────────────────────
const ts  = () => new Date().toISOString().replace('T', ' ').slice(0, 23);
const log = (...a) => console.log(`[${ts()}]`, ...a);
const err = (...a) => console.error(`[${ts()}] ❌`, ...a);

// ── Worker ───────────────────────────────────────────────────────────────────
const worker = new Worker('email-queue', async (job) => {
  const { recipientEmail, emailType, templateData, queuedAt, cc, leadId, triggeredBy } = job.data;

  log(`📨 Job ${job.id} | ${emailType} → ${recipientEmail}${cc ? ` (CC: ${cc})` : ''} | attempt=${job.attemptsMade + 1}/${job.opts?.attempts || 3} | queued=${queuedAt}`);

  const builder = templates[emailType];
  if (!builder) {
    const msg = `Unknown emailType "${emailType}" — discarding job ${job.id}`;
    err(msg);
    throw new Error(msg);
  }

  let subject, html, text;
  try {
    ({ subject, html, text } = builder(templateData));
    log(`   Subject : "${subject}"`);
  } catch (buildErr) {
    err(`Template build error for job ${job.id} (${emailType}): ${buildErr.message}`);
    throw buildErr;
  }

  let info;
  try {
    const mailOptions = {
      from:    cfg.from,
      to:      recipientEmail,
      replyTo: cfg.replyTo,
      subject,
      text,          // plain-text part — critical for inbox placement
      html,          // rich HTML part
      headers: spamSafeHeaders(recipientEmail),
    };

    // CC the company notification inbox when set (LEAD_ASSIGNED / LEAD_WON).
    // Using visible CC (not BCC) — spam filters view BCC on transactional mail
    // as a red flag, while CC signals a legitimate internal copy.
    if (cc && cc !== recipientEmail) {
      mailOptions.cc = cc;
    }

    info = await transporter.sendMail(mailOptions);
  } catch (smtpErr) {
    err(`SMTP send failed — job ${job.id}`);
    err(`   Type    : ${emailType}`);
    err(`   To      : ${recipientEmail}`);
    err(`   Code    : ${smtpErr.code || 'n/a'}`);
    err(`   Message : ${smtpErr.message}`);
    if (smtpErr.response)     err(`   Server  : ${smtpErr.response}`);
    if (smtpErr.responseCode) err(`   SMTP RC : ${smtpErr.responseCode}`);
    err(`   Stack   : ${smtpErr.stack}`);
    throw smtpErr;
  }

  log(`✅ Delivered — job ${job.id} | msgId=${info.messageId} | response=${info.response}`);

  // Persist email log — fire-and-forget, never blocks job completion
  EmailLog.create({
    leadId:         leadId || null,
    recipientEmail,
    cc:             cc || null,
    emailType,
    subject,
    bodyText:       text,
    bodyHtml:       html,
    status:         'sent',
    messageId:      info.messageId || '',
    triggeredBy:    triggeredBy || null,
    sentAt:         new Date(),
  }).catch((e) => err(`EmailLog save failed — job ${job.id}: ${e.message}`));

  return { messageId: info.messageId };

}, { connection: cfg.redis, concurrency: 5 });

// ── Worker events ────────────────────────────────────────────────────────────
worker.on('ready',     ()        => { log('✅ Worker ready — listening on "email-queue"'); });
worker.on('active',    (job)     => { log(`▶  Job ${job.id} active (${job.data?.emailType} → ${job.data?.recipientEmail})`); });
worker.on('completed', (job, r)  => { log(`✔  Job ${job.id} completed | msgId=${r?.messageId || 'n/a'}`); });
worker.on('failed',    (job, e)  => {
  const attempts = job?.attemptsMade ?? '?';
  const max = job?.opts?.attempts ?? 3;
  err(`Job ${job?.id} FAILED (${attempts}/${max}) — ${attempts < max ? 'will retry' : 'EXHAUSTED'}: ${e.message}`);
  if (attempts < max) log(`   Next retry in ~${(2000 * Math.pow(2, attempts - 1)) / 1000}s`);
});
worker.on('stalled',   (id)      => { log(`⚠  Job ${id} stalled — will be requeued`); });
worker.on('error',     (e)       => { err('Worker error:', e.message); });

// ── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async (sig) => {
  log(`${sig} — closing worker gracefully…`);
  await worker.close();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
