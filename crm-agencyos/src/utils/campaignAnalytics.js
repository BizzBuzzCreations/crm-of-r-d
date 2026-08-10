// Pure functions — all analytics are derived client-side from the already-
// loaded campaignLeads array (each lead embeds its own opens[]/clicks[]
// history), so there's no separate backend aggregation endpoint to keep in
// sync. Fine at B2B outbound campaign scale (hundreds–low thousands of
// leads); would need a server-side pipeline if that ever changes.

const dayKey = (d) => {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
};

const dayLabel = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * @param {Array} leads
 * @param {number|'all'} days - lookback window, or 'all' for the full campaign history
 * @returns {Array<{date:string, ts:number, sent:number, totalOpens:number, uniqueOpens:number, totalClicks:number, uniqueClicks:number, replied:number}>}
 */
export function buildDailySeries(leads, days = 7) {
  const events = []; // { ts, type, leadId }
  for (const l of leads) {
    if (l.sentAt) events.push({ ts: dayKey(l.sentAt), type: 'sent', leadId: l._id });
    for (const o of l.opens || []) events.push({ ts: dayKey(o.at), type: 'open', leadId: l._id });
    for (const c of l.clicks || []) events.push({ ts: dayKey(c.at), type: 'click', leadId: l._id });
    if (l.repliedAt) events.push({ ts: dayKey(l.repliedAt), type: 'replied', leadId: l._id });
  }

  if (!events.length) return [];

  const today = dayKey(new Date());
  const earliest = days === 'all' ? Math.min(...events.map((e) => e.ts)) : today - (days - 1) * 86400000;

  const buckets = new Map(); // ts -> { sent, totalOpens, uniqueOpenLeads:Set, totalClicks, uniqueClickLeads:Set, replied }
  for (let ts = earliest; ts <= today; ts += 86400000) {
    buckets.set(ts, { sent: 0, totalOpens: 0, uniqueOpenLeads: new Set(), totalClicks: 0, uniqueClickLeads: new Set(), replied: 0 });
  }

  for (const e of events) {
    const b = buckets.get(e.ts);
    if (!b) continue; // outside the selected window
    if (e.type === 'sent') b.sent += 1;
    else if (e.type === 'open') { b.totalOpens += 1; b.uniqueOpenLeads.add(e.leadId); }
    else if (e.type === 'click') { b.totalClicks += 1; b.uniqueClickLeads.add(e.leadId); }
    else if (e.type === 'replied') b.replied += 1;
  }

  return [...buckets.entries()].map(([ts, b]) => ({
    date: dayLabel(ts),
    ts,
    sent: b.sent,
    totalOpens: b.totalOpens,
    uniqueOpens: b.uniqueOpenLeads.size,
    totalClicks: b.totalClicks,
    uniqueClicks: b.uniqueClickLeads.size,
    replied: b.replied,
  }));
}

/**
 * Flattened, time-sorted (newest first) event feed for the Activity tab.
 */
export function buildActivityFeed(leads, limit = 200) {
  const events = [];
  for (const l of leads) {
    if (l.sentAt) events.push({ at: l.sentAt, type: 'sent', email: l.email });
    for (const o of l.opens || []) events.push({ at: o.at, type: 'opened', email: l.email });
    for (const c of l.clicks || []) events.push({ at: c.at, type: 'clicked', email: l.email, url: c.url });
    if (l.repliedAt) events.push({ at: l.repliedAt, type: 'replied', email: l.email });
    if (l.status === 'bounced') events.push({ at: l.updatedAt, type: 'bounced', email: l.email, detail: l.error });
    if (l.unsubscribedAt) events.push({ at: l.unsubscribedAt, type: 'unsubscribed', email: l.email });
  }
  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  return events.slice(0, limit);
}

/**
 * Single-row summary — campaigns here are single-email (no multi-step
 * sequences), so there's exactly one "step" to report on.
 */
export function buildStepSummary(leads) {
  const sent = leads.filter((l) => l.sentAt).length;
  const opened = leads.filter((l) => l.openCount > 0).length;
  const clicked = leads.filter((l) => l.clickCount > 0).length;
  const replied = leads.filter((l) => l.repliedAt).length;
  const callRequested = leads.filter((l) => l.callRequested).length;
  const responded = leads.filter((l) => l.responseOption).length;
  return {
    sent, opened, clicked, replied, callRequested, responded,
    openRate: sent ? (opened / sent) * 100 : 0,
    clickRate: sent ? (clicked / sent) * 100 : 0,
    replyRate: sent ? (replied / sent) * 100 : 0,
  };
}

export function getBounces(leads) {
  return leads.filter((l) => l.status === 'bounced');
}

/**
 * Count of leads per checkbox-style response option (see
 * Campaign.settings.responseOptions / the {{response_options}} merge tag) —
 * only counts each lead's most recent selection, same as the leads table.
 */
export function buildResponseBreakdown(leads) {
  const counts = new Map();
  for (const l of leads) {
    if (!l.responseOption) continue;
    counts.set(l.responseOption, (counts.get(l.responseOption) || 0) + 1);
  }
  return [...counts.entries()].map(([option, count]) => ({ option, count })).sort((a, b) => b.count - a.count);
}
