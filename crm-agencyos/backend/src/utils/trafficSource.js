'use strict';
// Categorizes a session into one bucket, checking UTM params first (explicit
// campaign tagging always wins), then falling back to referrer-domain
// heuristics. Matches the enum on WitSession.trafficSource.
const SEARCH_ENGINES = ['google.', 'bing.', 'yahoo.', 'duckduckgo.', 'baidu.', 'yandex.'];
const SOCIAL_DOMAINS = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'pinterest.com', 'reddit.com', 'youtube.com'];

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function categorize({ utmSource, utmMedium, referrer, siteDomain }) {
  const src = (utmSource || '').toLowerCase();
  const medium = (utmMedium || '').toLowerCase();

  if (src) {
    if (src.includes('facebook') || src.includes('meta') || src.includes('instagram')) return 'paid-meta';
    if (src.includes('google') && (medium.includes('cpc') || medium.includes('ppc') || medium.includes('paid'))) return 'paid-google';
    if (src.includes('linkedin')) return 'linkedin';
    if (medium.includes('email') || medium.includes('newsletter') || src.includes('email')) return 'email';
    if (medium === 'social' || SOCIAL_DOMAINS.some((d) => src.includes(d.split('.')[0]))) return 'social';
    if (medium.includes('cpc') || medium.includes('ppc') || medium.includes('paid')) return src.includes('google') ? 'paid-google' : 'referral';
  }

  const refDomain = domainOf(referrer);
  if (!refDomain || refDomain === (siteDomain || '').replace(/^www\./, '')) return 'direct';
  if (SEARCH_ENGINES.some((e) => refDomain.includes(e))) return 'organic';
  if (SOCIAL_DOMAINS.some((d) => refDomain === d || refDomain.endsWith('.' + d))) return 'social';
  if (refDomain.includes('linkedin.com')) return 'linkedin';
  return 'referral';
}

const TRAFFIC_SOURCE_LABELS = {
  organic: 'Organic Search',
  direct: 'Direct',
  'paid-meta': 'Meta Ads',
  'paid-google': 'Google Ads',
  linkedin: 'LinkedIn',
  social: 'Social Media',
  email: 'Email Campaigns',
  referral: 'Referral Websites',
};

module.exports = { categorize, domainOf, TRAFFIC_SOURCE_LABELS };
