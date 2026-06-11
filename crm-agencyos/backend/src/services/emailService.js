const nodemailer = require('nodemailer');

// Build a transporter from env; returns null when SMTP is not configured
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth:   { user, pass },
  });
}

/**
 * Send the client portal welcome email with login credentials.
 * Returns true on success, false if SMTP is not configured.
 * Never throws — email failure must not block client creation.
 */
exports.sendClientWelcome = async ({ to, clientName, contactName, password, loginUrl }) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[emailService] SMTP not configured — skipping welcome email to', to);
    return false;
  }

  const from = process.env.EMAIL_FROM || `"BBC Creations" <hello@bizzbuzzcreations.com>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:520px;margin:40px auto;padding:0 20px;">

    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hi ${contactName},</p>

    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
      I've set up your client portal so you can check in on your project progress, tasks, and meetings whenever you'd like.
    </p>

    <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">Here are your login details:</p>

    <div style="background:#f7f7f7;border-left:3px solid #4f46e5;padding:14px 18px;margin:16px 0;font-size:14px;line-height:1.8;">
      <strong>Portal:</strong> <a href="${loginUrl}/login" style="color:#4f46e5;text-decoration:none;">${loginUrl}/login</a><br/>
      <strong>Email:</strong> ${to}<br/>
      <strong>Password:</strong> <span style="font-family:monospace;">${password}</span>
    </div>

    <p style="font-size:15px;line-height:1.6;margin:16px 0;">
      Feel free to log in anytime. If you have any questions, just reply to this email and I'll get back to you.
    </p>

    <p style="font-size:15px;line-height:1.6;margin:16px 0 0;">
      Best,<br/>
      BBC Creations
    </p>

    <hr style="border:none;border-top:1px solid #eeeeee;margin:32px 0 16px;" />
    <p style="font-size:12px;color:#888888;margin:0;line-height:1.5;">
      This email was sent to ${to} because an account was created on your behalf. If you weren't expecting this, you can ignore it.
    </p>

  </div>
</body>
</html>`;

  const text = `Hi ${contactName},

I've set up your client portal so you can check in on your project progress, tasks, and meetings whenever you'd like.

Here are your login details:

  Portal:   ${loginUrl}/login
  Email:    ${to}
  Password: ${password}

Feel free to log in anytime. If you have any questions, just reply to this email.

Best,
BBC Creations`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `Your portal access for ${clientName}`,
      html,
      text,
    });
    return true;
  } catch (err) {
    console.error('[emailService] Failed to send welcome email:', err.message);
    return false;
  }
};
