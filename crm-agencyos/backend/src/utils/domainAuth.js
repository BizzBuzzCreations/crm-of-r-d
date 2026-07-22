'use strict';
// SPF / DMARC / DKIM presence check for a sending domain. This is read-only
// diagnostics — it cannot configure DNS records for you (that has to happen
// on your domain registrar/DNS host), it only tells you what's missing.
// This is the single biggest lever for inbox-vs-spam placement, bigger than
// any in-app sending setting: without these, receiving mail servers have no
// way to confirm you're actually authorized to send as your domain.
const dns = require('dns');

const resolver = new dns.promises.Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1']);

// Best-effort — DKIM selectors are provider-specific and not discoverable
// via DNS alone. Covers the common ones (Google Workspace, generic default
// selectors); a provider using a custom selector won't be found here, and
// the result says so rather than falsely claiming DKIM is missing.
const COMMON_DKIM_SELECTORS = ['google', 'selector1', 'selector2', 'k1', 'default', 'dkim', 'mail', 's1', 's2'];

function withTimeout(promise, ms, fallback) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

async function resolveTxtFlat(hostname) {
  const records = await withTimeout(resolver.resolveTxt(hostname).catch((e) => { throw e; }), 5000, 'timeout');
  if (records === 'timeout') return { records: null, timedOut: true };
  return { records: records.map((r) => r.join('')), timedOut: false };
}

async function checkSpf(domain) {
  try {
    const { records, timedOut } = await resolveTxtFlat(domain);
    if (timedOut) return { found: false, record: '', detail: 'DNS lookup timed out' };
    const match = records.find((r) => r.toLowerCase().startsWith('v=spf1'));
    return match ? { found: true, record: match } : { found: false, record: '', detail: 'No SPF TXT record found on the root domain' };
  } catch (e) {
    const notFound = e.code === 'ENOTFOUND' || e.code === 'ENODATA';
    return { found: false, record: '', detail: notFound ? 'No SPF TXT record found on the root domain' : `Lookup failed (${e.code || e.message})` };
  }
}

async function checkDmarc(domain) {
  try {
    const { records, timedOut } = await resolveTxtFlat(`_dmarc.${domain}`);
    if (timedOut) return { found: false, record: '', detail: 'DNS lookup timed out' };
    const match = records.find((r) => r.toLowerCase().startsWith('v=dmarc1'));
    return match ? { found: true, record: match } : { found: false, record: '', detail: 'No DMARC record found at _dmarc.' + domain };
  } catch (e) {
    const notFound = e.code === 'ENOTFOUND' || e.code === 'ENODATA';
    return { found: false, record: '', detail: notFound ? 'No DMARC record found at _dmarc.' + domain : `Lookup failed (${e.code || e.message})` };
  }
}

async function checkDkim(domain) {
  for (const selector of COMMON_DKIM_SELECTORS) {
    try {
      const { records, timedOut } = await withTimeout(
        resolveTxtFlat(`${selector}._domainkey.${domain}`), 3000, { records: null, timedOut: true }
      );
      if (timedOut || !records) continue;
      const flat = records.join('');
      if (flat.toLowerCase().includes('v=dkim1') || flat.toLowerCase().includes('k=rsa') || flat.toLowerCase().includes('p=')) {
        return { found: true, selector };
      }
    } catch { /* try next selector */ }
  }
  return {
    found: false, selector: null,
    detail: `No DKIM record found at common selectors (${COMMON_DKIM_SELECTORS.join(', ')}) — your provider may use a selector we don't know to check. Confirm directly with whoever set up your sending domain.`,
  };
}

async function checkDomainAuth(domain) {
  const [spf, dmarc, dkim] = await Promise.all([checkSpf(domain), checkDmarc(domain), checkDkim(domain)]);
  return { domain, spf, dmarc, dkim, checkedAt: new Date() };
}

module.exports = { checkDomainAuth };
