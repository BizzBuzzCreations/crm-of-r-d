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

// Returns every A record, not just one. Hosts fronted by an anycast network
// (Cloudflare, in the case that motivated this file) can have individual
// edge IPs that are unreachable from a specific network path even though
// the hostname as a whole is fine — a caller that always picks the same
// address gets permanently stuck on a bad one. Callers that retry should
// pick a different candidate each time (see resolveIPv4).
async function resolveIPv4All(hostname) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return [hostname]; // already a literal IP
  try {
    const addrs = await resolver.resolve4(hostname);
    return addrs.length ? addrs : null;
  } catch {
    return null; // let the caller fall back to connecting by hostname
  }
}

// Picks one address at random from the resolved set, so repeated calls
// (e.g. across retries, once a caller invalidates its cache) have a chance
// of landing on a reachable edge instead of always retrying the same one.
async function resolveIPv4(hostname) {
  const addrs = await resolveIPv4All(hostname);
  if (!addrs) return null;
  return addrs[Math.floor(Math.random() * addrs.length)];
}

module.exports = { resolveIPv4, resolveIPv4All };
