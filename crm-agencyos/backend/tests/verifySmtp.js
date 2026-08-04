// backend/src/verifySmtp.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

console.log('Testing SMTP connection with settings:');
console.log('Host:', process.env.SMTP_HOST);
console.log('Port:', process.env.SMTP_PORT);
console.log('Secure:', process.env.SMTP_SECURE);
console.log('User:', process.env.SMTP_USER);
const pass = (process.env.SMTP_PASS || '').replace(/\s/g, '');
console.log('Pass Length:', pass.length);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: pass
  },
  tls: {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
  },
  connectionTimeout: 10000
});

transporter.verify((err, success) => {
  if (err) {
    console.error('❌ SMTP CONNECTION FAILED:', err);
  } else {
    console.log('✅ SMTP CONNECTION VERIFIED SUCCESSFULLY! Credentials are correct.');
  }
  process.exit(err ? 1 : 0);
});
