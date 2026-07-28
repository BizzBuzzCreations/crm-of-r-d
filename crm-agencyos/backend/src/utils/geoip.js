'use strict';
// Best-effort IP → Country/Region/City lookup using ip-api.com's free JSON
// endpoint (no key required, reasonable rate limits, fine for prototyping
// and low-to-moderate traffic). This is NOT ToS-compliant for high-volume
// commercial use — for production accuracy and licensing, swap this for a
// local MaxMind GeoLite2 database or a paid provider like ipinfo.io. Never
// blocks tracking on failure: any error just leaves country/region/city
// blank, same as the "degraded but working" pattern used elsewhere in this
// codebase (Meta Ads conversion matching, Google Sheets sync).
const cache = new Map(); // ip -> { result, expiresAt }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // a visitor's IP rarely changes location within a day
const LOOKUP_TIMEOUT_MS = 2000;

function isPrivateIp(ip) {
  if (!ip) return true;
  return (
    ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') ||
    ip.startsWith('10.') || ip.startsWith('172.16.') || ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') || ip.startsWith('172.19.') || ip.startsWith('172.2') ||
    ip.startsWith('172.30.') || ip.startsWith('172.31.') || ip.startsWith('::ffff:127.')
  );
}

async function lookupGeo(ip) {
  const empty = { country: '', region: '', city: '' };
  if (isPrivateIp(ip)) return empty;

  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`, { signal: controller.signal });
    clearTimeout(timeout);
    const json = await res.json();
    const result = json.status === 'success'
      ? { country: json.country || '', region: json.regionName || '', city: json.city || '' }
      : empty;
    cache.set(ip, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch {
    return empty;
  }
}

module.exports = { lookupGeo, isPrivateIp };
