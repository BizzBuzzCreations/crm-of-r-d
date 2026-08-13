'use strict';
// Pure, deterministic, no-LLM scoring — same style as
// controllers/leadController.js's calculateHealthScore. Two independent
// axes: how much a business's website needs technical/SEO help, and how
// much evidence there is that they already invest in marketing (worth
// pitching vs. not). Combined into a single tier that decides the outreach
// approach, not just a raw number.

function calculateTechnicalScore(audit) {
  let score = 0;
  if (!audit.hasSSL) score += 15;
  if (audit.psiPerformanceScore != null && audit.psiPerformanceScore < 50) score += 15;
  if (!audit.hasViewportTag) score += 10;
  if (audit.psiSeoScore != null && audit.psiSeoScore < 70) score += 10;
  if (!audit.title?.trim() || !audit.metaDescription?.trim()) score += 10;
  if (!audit.h1Present) score += 8;
  if (!audit.hasAnalytics) score += 8;
  if (!audit.cmsPlatform) score += 10; // no recognizable/modern CMS signature detected
  if (!audit.hasSitemap && !audit.hasRobotsTxt) score += 6;
  // A noindex tag means Google won't show this site in search results at
  // all, regardless of anything else being fine — the single worst finding
  // this crawler can make, weighted accordingly. Missing canonical tag is
  // real but much more common/minor on small sites, so it's a light touch.
  if (audit.hasNoindexTag) score += 25;
  if (!audit.hasCanonicalTag) score += 5;
  // Hard floor, same pattern as leadController's healthScore override: +25
  // alone isn't guaranteed to cross the "skip" threshold (30) if every
  // other factor is otherwise clean, which would wrongly tier a noindexed
  // site as "fine, don't bother" — exactly backwards, since "your site is
  // invisible to Google" is one of the strongest pitches there is.
  if (audit.hasNoindexTag) score = Math.max(score, 40);
  return Math.min(100, score);
}

function calculateOpportunityScore(audit) {
  let score = 0;
  if (audit.hasAdsPixel) score += 30;
  if (audit.hasAnalytics) score += 15;
  if (audit.hasBlog) score += 15;
  if (audit.hasContactForm) score += 15;
  if (audit.crawlStatus === 'ok') score += 15; // site is live and reachable at all
  if ((audit.reviewsCount || 0) >= 20) score += 10; // proxy for "actively getting found/customers"
  return Math.min(100, score);
}

function buildFlags(audit, technicalScore, opportunityScore) {
  const flags = [];
  if (!audit.hasSSL) flags.push('no_ssl');
  if (audit.psiPerformanceScore != null && audit.psiPerformanceScore < 50) flags.push('slow_load');
  if (!audit.hasViewportTag) flags.push('not_mobile_friendly');
  if (!audit.hasAnalytics) flags.push('no_analytics');
  if (audit.hasAdsPixel) flags.push('running_ads');
  if ((audit.reviewsCount || 0) >= 20) flags.push('established_reviews');
  if (audit.hasNoindexTag) flags.push('noindex_detected');
  if (!audit.hasCanonicalTag) flags.push('no_canonical');
  if (technicalScore < 30) flags.push('technically_sound');
  if (opportunityScore >= 50) flags.push('high_opportunity');
  return flags;
}

/**
 * @param {object} audit - a ProspectAudit document (or plain object with the same fields)
 * @returns {{ technicalScore: number, opportunityScore: number, tier: string, flags: string[] }}
 */
function calculateProspectScores(audit) {
  if (audit.crawlStatus !== 'ok') {
    return { technicalScore: null, opportunityScore: null, tier: 'no_site', flags: ['no_site'] };
  }

  const technicalScore = calculateTechnicalScore(audit);
  const opportunityScore = calculateOpportunityScore(audit);
  const flags = buildFlags(audit, technicalScore, opportunityScore);

  // technicalScore is a NEED score — higher means MORE problems found, not
  // fewer. So "skip" (the site's already fine, nothing to pitch) is a LOW
  // technicalScore, not a high one. Everything else worth pitching gets
  // tiered purely by how much marketing opportunity it shows.
  let tier;
  if (technicalScore < 30) tier = 'skip';
  else if (opportunityScore >= 50) tier = 'high';
  else if (opportunityScore >= 25) tier = 'medium';
  else tier = 'low';

  return { technicalScore, opportunityScore, tier, flags };
}

module.exports = { calculateProspectScores, calculateTechnicalScore, calculateOpportunityScore };
