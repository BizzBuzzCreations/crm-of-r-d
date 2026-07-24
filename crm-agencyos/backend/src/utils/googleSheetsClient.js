'use strict';
// Thin, cached auth wrapper around the Sheets API using a Service Account —
// no per-user OAuth flow needed. The service account must be shared as an
// Editor on the target spreadsheet (Share -> paste the service account's
// email) for any of this to work; it has no access otherwise.
const { google } = require('googleapis');

let cachedClient = null;

function getCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) return null;
  // .env files can't hold a real multi-line PEM key — it's stored with
  // literal "\n" escape sequences and needs to be restored to real newlines.
  return { email, privateKey: rawKey.replace(/\\n/g, '\n') };
}

function isConfigured() {
  return !!getCredentials() && !!process.env.GOOGLE_ASSIGNMENT_SHEET_ID;
}

async function getSheetsClient() {
  if (cachedClient) return cachedClient;
  const creds = getCredentials();
  if (!creds) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY not set');
  const auth = new google.auth.JWT({
    email: creds.email,
    key: creds.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

module.exports = { getSheetsClient, isConfigured, getCredentials };
