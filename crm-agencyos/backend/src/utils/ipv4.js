'use strict';
// Resolves a hostname to a literal IPv4 address before connecting, instead
// of trusting nodemailer/Node's own DNS path to prefer IPv4. Some hosts
// (this app has hit it with Cloudflare-fronted SMTP, e.g. Hostinger) return
// both A and AAAA records, and connections can end up going out over IPv6
// on a server with no real outbound IPv6 routing — ENETUNREACH. `family: 4`
// and `dns.setDefaultResultOrder('ipv4first')` both *ask* for IPv4 but
// don't guarantee every library's internal connection path honors it;
// resolving to a literal IP ourselves removes that ambiguity entirely.
const dns = require('dns');

const resolver = new dns.promises.Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1']);

async function resolveIPv4(hostname) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return hostname; // already a literal IP
  try {
    const addrs = await resolver.resolve4(hostname);
    return addrs[0] || null;
  } catch {
    return null; // let the caller fall back to connecting by hostname
  }
}

module.exports = { resolveIPv4 };
