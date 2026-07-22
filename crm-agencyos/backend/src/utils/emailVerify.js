'use strict';
// Lightweight email verification — syntax + MX record lookup + provider
// detection. No paid third-party API. Deliberately does NOT do an SMTP
// RCPT-TO handshake (fragile, easily blocked/greylisted by receiving
// servers, and often flagged as abuse) — MX presence is the honest limit
// of what's safely checkable here: it confirms the domain can receive
// mail, not that the specific mailbox exists.
const dns = require('dns');

// Use known-good public DNS resolvers instead of trusting whatever the
// host's OS/network has configured — an unreachable or misconfigured
// system resolver (common on bare-metal boxes, VPNs, some VPS images)
// causes ECONNREFUSED on every single lookup regardless of the domain
// being queried, which would otherwise make every non-fast-path email
// look "invalid". Falls back to plain dns.promises if constructing a
// custom resolver isn't supported for some reason.
let resolver;
try {
  resolver = new dns.promises.Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1']);
} catch {
  resolver = dns.promises;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CONSUMER_PROVIDERS = {
  'gmail.com': 'Gmail', 'googlemail.com': 'Gmail',
  'outlook.com': 'Outlook', 'hotmail.com': 'Outlook', 'live.com': 'Outlook', 'msn.com': 'Outlook',
  'yahoo.com': 'Yahoo', 'ymail.com': 'Yahoo', 'rocketmail.com': 'Yahoo',
  'icloud.com': 'iCloud', 'me.com': 'iCloud', 'mac.com': 'iCloud',
  'aol.com': 'AOL',
  'protonmail.com': 'ProtonMail', 'proton.me': 'ProtonMail',
  'zoho.com': 'Zoho Mail',
  'gmx.com': 'GMX',
  'yandex.com': 'Yandex',
};

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'throwawaymail.com',
  'yopmail.com', 'trashmail.com', 'getnada.com', 'sharklasers.com', 'fakeinbox.com', 'dispostable.com',
  'maildrop.cc', 'moakt.com', 'mintemail.com', 'temp-mail.org',
]);

function providerFromMx(mxHosts) {
  const joined = mxHosts.join(' ').toLowerCase();
  if (joined.includes('google.com') || joined.includes('googlemail.com')) return 'Google Workspace';
  if (joined.includes('outlook.com') || joined.includes('protection.outlook.com')) return 'Microsoft 365';
  if (joined.includes('zoho.com')) return 'Zoho Mail';
  if (joined.includes('yahoodns.net')) return 'Yahoo Business';
  if (joined.includes('amazonses.com') || joined.includes('pphosted.com') || joined.includes('mimecast.com')) return 'Other (hosted)';
  return 'Other';
}

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Resolves once per unique DOMAIN (not per email) — callers should dedupe.
async function resolveDomain(domain) {
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { status: 'risky', detail: 'Disposable/temporary email domain', provider: 'Disposable' };
  }
  if (CONSUMER_PROVIDERS[domain]) {
    return { status: 'valid', detail: 'Recognized provider', provider: CONSUMER_PROVIDERS[domain] };
  }
  let records;
  try {
    records = await withTimeout(resolver.resolveMx(domain), 5000, 'timeout');
  } catch (e) {
    // ENOTFOUND/ENODATA mean the domain genuinely has no mail servers —
    // that's a confident "invalid". Anything else (ECONNREFUSED, SERVFAIL,
    // network blips) is a resolver problem, not a fact about the domain —
    // don't punish the lead for our DNS resolver having a bad moment.
    if (e.code === 'ENOTFOUND' || e.code === 'ENODATA') {
      return { status: 'invalid', detail: 'Domain has no mail servers (no MX records)', provider: '' };
    }
    return { status: 'unverified', detail: `DNS lookup failed (${e.code || e.message}) — retry later`, provider: '' };
  }
  if (records === 'timeout') {
    return { status: 'unverified', detail: 'DNS lookup timed out', provider: '' };
  }
  if (!records.length) {
    return { status: 'invalid', detail: 'Domain has no mail servers (no MX records)', provider: '' };
  }
  const hosts = [...records].sort((a, b) => a.priority - b.priority).map((r) => r.exchange);
  return { status: 'valid', detail: `MX: ${hosts[0]}`, provider: providerFromMx(hosts) };
}

async function verifyEmail(email) {
  const lower = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(lower)) return { status: 'invalid', detail: 'Invalid email format', provider: '' };
  return resolveDomain(lower.split('@')[1]);
}

// Bounded-concurrency, domain-deduplicated batch verify. A CSV of hundreds
// of leads from a handful of companies only costs one DNS lookup per
// company domain, not one per lead.
async function verifyBatch(emails, concurrency = 20) {
  const domains = [...new Set(
    emails.filter((e) => EMAIL_RE.test(e)).map((e) => e.split('@')[1])
  )];
  const domainResults = new Map();
  let i = 0;
  async function worker() {
    while (i < domains.length) {
      const domain = domains[i++];
      domainResults.set(domain, await resolveDomain(domain));
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, domains.length)) }, worker));

  const results = new Map();
  for (const email of emails) {
    if (!EMAIL_RE.test(email)) {
      results.set(email, { status: 'invalid', detail: 'Invalid email format', provider: '' });
      continue;
    }
    results.set(email, domainResults.get(email.split('@')[1]));
  }
  return results;
}

module.exports = { verifyEmail, verifyBatch };
