'use strict';
const TrackedWebsite = require('../models/TrackedWebsite');
const WitVisitor = require('../models/WitVisitor');
const WitSession = require('../models/WitSession');
const WitPageview = require('../models/WitPageview');
const WitFormEvent = require('../models/WitFormEvent');
const Lead = require('../models/Lead');
const { TRAFFIC_SOURCE_LABELS } = require('../utils/trafficSource');

// ── Shared helpers ───────────────────────────────────────────────
function defaultRange() {
  const to = new Date();
  const from = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
}
function resolveRange(req) {
  const { from, to } = req.query;
  const d = defaultRange();
  return { from: from || d.from, to: to || d.to };
}
function rangeToDates(from, to) {
  const fromDate = new Date(from + 'T00:00:00.000Z');
  const toDate = new Date(to + 'T23:59:59.999Z');
  return { fromDate, toDate };
}
function siteFilter(req) {
  return req.query.websiteId ? { websiteId: req.query.websiteId } : {};
}
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// ══════════════════════════════════════════════════════════════
// Websites (Settings → Websites)
// ══════════════════════════════════════════════════════════════

// @GET /api/website-intelligence/websites
exports.getWebsites = async (req, res, next) => {
  try {
    // apiSecretEncrypted is select:false on the schema — must opt back in
    // here to compute hasSecret, or it's always undefined and hasSecret is
    // always false regardless of whether a secret is actually configured.
    const websites = await TrackedWebsite.find({}).select('+apiSecretEncrypted').sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: websites.map((w) => ({ ...w, hasSecret: !!w.apiSecretEncrypted, apiSecretEncrypted: undefined })) });
  } catch (err) { next(err); }
};

// @POST /api/website-intelligence/websites — apiSecret is returned ONCE here, never again.
exports.createWebsite = async (req, res, next) => {
  try {
    const { name, domain } = req.body;
    if (!name?.trim() || !domain?.trim()) {
      return res.status(400).json({ success: false, message: 'Name and domain are required.' });
    }
    const trackingId = TrackedWebsite.generateTrackingId();
    const apiSecret = TrackedWebsite.generateApiSecret();
    const website = new TrackedWebsite({ name: name.trim(), domain: domain.trim(), trackingId, createdBy: req.user?._id });
    website.apiSecret = apiSecret; // virtual setter — encrypts
    await website.save();

    const obj = website.toObject();
    delete obj.apiSecretEncrypted;
    res.status(201).json({ success: true, data: { ...obj, apiSecret } }); // plaintext, this one time only
  } catch (err) { next(err); }
};

// @PUT /api/website-intelligence/websites/:id
exports.updateWebsite = async (req, res, next) => {
  try {
    const { name, domain, isActive } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (domain !== undefined) update.domain = domain.trim();
    if (isActive !== undefined) update.isActive = !!isActive;
    const website = await TrackedWebsite.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!website) return res.status(404).json({ success: false, message: 'Website not found' });
    delete website.apiSecretEncrypted;
    res.json({ success: true, data: website });
  } catch (err) { next(err); }
};

// @POST /api/website-intelligence/websites/:id/regenerate-secret
exports.regenerateSecret = async (req, res, next) => {
  try {
    const website = await TrackedWebsite.findById(req.params.id);
    if (!website) return res.status(404).json({ success: false, message: 'Website not found' });
    const apiSecret = TrackedWebsite.generateApiSecret();
    website.apiSecret = apiSecret;
    await website.save();
    res.json({ success: true, data: { apiSecret } });
  } catch (err) { next(err); }
};

// @DELETE /api/website-intelligence/websites/:id — removes the site and its
// raw tracking data (visitors/sessions/pageviews/form events — pure
// analytics, safe to purge). Real pipeline Leads are NEVER deleted by this;
// they're kept, just unlinked (websiteId cleared) so a lead a salesperson is
// actively working doesn't vanish because someone cleaned up a website entry.
exports.deleteWebsite = async (req, res, next) => {
  try {
    const website = await TrackedWebsite.findById(req.params.id);
    if (!website) return res.status(404).json({ success: false, message: 'Website not found' });

    await Promise.all([
      WitVisitor.deleteMany({ websiteId: website._id }),
      WitSession.deleteMany({ websiteId: website._id }),
      WitPageview.deleteMany({ websiteId: website._id }),
      WitFormEvent.deleteMany({ websiteId: website._id }),
      Lead.updateMany({ websiteId: website._id }, { websiteId: null }),
    ]);
    await TrackedWebsite.deleteOne({ _id: website._id });

    res.json({ success: true });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════
// Dashboard: Summary KPIs
// ══════════════════════════════════════════════════════════════

// @GET /api/website-intelligence/summary?websiteId&from&to
exports.getSummary = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const { fromDate, toDate } = rangeToDates(from, to);
    const site = siteFilter(req);

    const sessionMatch = { ...site, startedAt: { $gte: fromDate, $lte: toDate } };
    const sessions = await WitSession.find(sessionMatch).select('visitorId isNewVisitor duration pageCount isBounce leadId').lean();

    const totalSessions = sessions.length;
    const distinctVisitors = new Set(sessions.map((s) => s.visitorId));
    const totalVisitors = distinctVisitors.size;
    const newVisitorIds = new Set(sessions.filter((s) => s.isNewVisitor).map((s) => s.visitorId));
    const newVisitors = newVisitorIds.size;
    const returningVisitors = Math.max(0, totalVisitors - newVisitors);
    const avgSessionDuration = totalSessions ? round2(sessions.reduce((a, s) => a + (s.duration || 0), 0) / totalSessions) : 0;
    const bounceRate = totalSessions ? round2((sessions.filter((s) => s.isBounce).length / totalSessions) * 100) : 0;

    const activeSince = new Date(Date.now() - 5 * 60 * 1000);
    const activeVisitorIds = await WitSession.distinct('visitorId', { ...site, lastSeenAt: { $gte: activeSince } });

    const leads = await Lead.find({ ...(site.websiteId ? { websiteId: site.websiteId } : { websiteId: { $ne: null } }), createdAt: { $gte: fromDate, $lte: toDate } })
      .select('status dealValue').lean();
    const leadsGenerated = leads.length;
    const revenueGenerated = round2(leads.filter((l) => l.status === 'Won').reduce((a, l) => a + (l.dealValue || 0), 0));
    const conversionRate = totalVisitors ? round2((leadsGenerated / totalVisitors) * 100) : 0;

    res.json({
      success: true,
      data: {
        range: { from, to },
        totalVisitors, activeVisitors: activeVisitorIds.length, newVisitors, returningVisitors,
        totalSessions, avgSessionDuration, bounceRate,
        leadsGenerated, conversionRate, revenueGenerated,
      },
    });
  } catch (err) { next(err); }
};

// @GET /api/website-intelligence/trends?websiteId&from&to&granularity
exports.getTrends = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const { fromDate, toDate } = rangeToDates(from, to);
    const site = siteFilter(req);
    const granularity = ['daily', 'weekly', 'monthly'].includes(req.query.granularity) ? req.query.granularity : 'daily';

    const bucketKey = (date) => {
      const iso = date.toISOString().split('T')[0];
      if (granularity === 'daily') return iso;
      if (granularity === 'monthly') return iso.slice(0, 7);
      const d = new Date(date);
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() + ((day === 0 ? -6 : 1) - day));
      return d.toISOString().split('T')[0];
    };

    const sessions = await WitSession.find({ ...site, startedAt: { $gte: fromDate, $lte: toDate } }).select('visitorId startedAt isNewVisitor').lean();
    const leads = await Lead.find({ ...(site.websiteId ? { websiteId: site.websiteId } : { websiteId: { $ne: null } }), createdAt: { $gte: fromDate, $lte: toDate } })
      .select('status dealValue createdAt').lean();

    const buckets = new Map();
    const ensure = (key) => {
      if (!buckets.has(key)) buckets.set(key, { date: key, visitors: new Set(), newVisitors: new Set(), sessions: 0, leads: 0, revenue: 0 });
      return buckets.get(key);
    };
    sessions.forEach((s) => {
      const b = ensure(bucketKey(s.startedAt));
      b.visitors.add(s.visitorId);
      if (s.isNewVisitor) b.newVisitors.add(s.visitorId);
      b.sessions += 1;
    });
    leads.forEach((l) => {
      const b = ensure(bucketKey(l.createdAt));
      b.leads += 1;
      if (l.status === 'Won') b.revenue += l.dealValue || 0;
    });

    // returningVisitors mirrors getSummary's exact method: total distinct
    // visitors in the bucket minus those whose isNewVisitor session landed
    // here — not a separately-tracked set, so the two numbers can't drift.
    const trend = Array.from(buckets.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((b) => ({
        date: b.date,
        visitors: b.visitors.size,
        newVisitors: b.newVisitors.size,
        returningVisitors: Math.max(0, b.visitors.size - b.newVisitors.size),
        sessions: b.sessions, leads: b.leads, revenue: round2(b.revenue),
      }));

    res.json({ success: true, data: { granularity, range: { from, to }, trend } });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════
// Traffic Sources
// ══════════════════════════════════════════════════════════════

// @GET /api/website-intelligence/traffic-sources?websiteId&from&to
exports.getTrafficSources = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const { fromDate, toDate } = rangeToDates(from, to);
    const site = siteFilter(req);

    const sessions = await WitSession.find({ ...site, startedAt: { $gte: fromDate, $lte: toDate } })
      .select('sessionId visitorId trafficSource leadId').lean();

    const sessionIds = sessions.map((s) => s.sessionId);
    const leads = await Lead.find({ websiteSessionId: { $in: sessionIds } }).select('websiteSessionId status dealValue').lean();
    const leadsBySession = new Map(leads.map((l) => [l.websiteSessionId, l]));

    const bySource = new Map();
    Object.keys(TRAFFIC_SOURCE_LABELS).forEach((k) => bySource.set(k, { source: k, label: TRAFFIC_SOURCE_LABELS[k], visitors: new Set(), sessions: 0, leads: 0, customers: 0, revenue: 0 }));

    sessions.forEach((s) => {
      const bucket = bySource.get(s.trafficSource) || bySource.get('direct');
      bucket.visitors.add(s.visitorId);
      bucket.sessions += 1;
      const lead = leadsBySession.get(s.sessionId);
      if (lead) {
        bucket.leads += 1;
        if (lead.status === 'Won') { bucket.customers += 1; bucket.revenue += lead.dealValue || 0; }
      }
    });

    const rows = Array.from(bySource.values())
      .map((b) => ({
        source: b.source, label: b.label, visitors: b.visitors.size, sessions: b.sessions,
        leads: b.leads, customers: b.customers, revenue: round2(b.revenue),
        conversionRate: b.visitors.size ? round2((b.leads / b.visitors.size) * 100) : 0,
      }))
      .filter((r) => r.visitors > 0)
      .sort((a, b) => b.visitors - a.visitors);

    res.json({ success: true, data: { range: { from, to }, sources: rows } });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════
// Country Distribution — visitors/leads/revenue grouped by country.
// Country comes from a best-effort IP geolocation lookup done once per new
// session (see geoip.js) — expect some "Unknown" rows for lookup failures,
// and note that req.ip only resolves to the real visitor address in
// production because app.js sets `trust proxy` for the nginx hop in front.
// ══════════════════════════════════════════════════════════════

// @GET /api/website-intelligence/countries?websiteId&from&to
exports.getCountries = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const { fromDate, toDate } = rangeToDates(from, to);
    const site = siteFilter(req);

    const sessions = await WitSession.find({ ...site, startedAt: { $gte: fromDate, $lte: toDate } })
      .select('sessionId visitorId country').lean();

    const sessionIds = sessions.map((s) => s.sessionId);
    const leads = await Lead.find({ websiteSessionId: { $in: sessionIds } }).select('websiteSessionId status dealValue').lean();
    const leadsBySession = new Map(leads.map((l) => [l.websiteSessionId, l]));

    const byCountry = new Map();
    sessions.forEach((s) => {
      const key = s.country || 'Unknown';
      const bucket = byCountry.get(key) || { country: key, visitors: new Set(), sessions: 0, leads: 0, customers: 0, revenue: 0 };
      bucket.visitors.add(s.visitorId);
      bucket.sessions += 1;
      const lead = leadsBySession.get(s.sessionId);
      if (lead) {
        bucket.leads += 1;
        if (lead.status === 'Won') { bucket.customers += 1; bucket.revenue += lead.dealValue || 0; }
      }
      byCountry.set(key, bucket);
    });

    const rows = Array.from(byCountry.values())
      .map((b) => ({
        country: b.country, visitors: b.visitors.size, sessions: b.sessions,
        leads: b.leads, customers: b.customers, revenue: round2(b.revenue),
        conversionRate: b.visitors.size ? round2((b.leads / b.visitors.size) * 100) : 0,
      }))
      .sort((a, b) => b.visitors - a.visitors);

    res.json({ success: true, data: { range: { from, to }, countries: rows } });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════
// Device / Browser / OS Analytics
// ══════════════════════════════════════════════════════════════

// @GET /api/website-intelligence/devices?websiteId&from&to
exports.getDevices = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const { fromDate, toDate } = rangeToDates(from, to);
    const site = siteFilter(req);

    const sessions = await WitSession.find({ ...site, startedAt: { $gte: fromDate, $lte: toDate } })
      .select('deviceType browser os').lean();

    const tally = (rows, key) => {
      const counts = new Map();
      rows.forEach((r) => {
        const k = r[key] || 'Unknown';
        counts.set(k, (counts.get(k) || 0) + 1);
      });
      return Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    };

    res.json({
      success: true,
      data: {
        range: { from, to },
        devices: tally(sessions, 'deviceType'),
        browsers: tally(sessions, 'browser'),
        operatingSystems: tally(sessions, 'os'),
      },
    });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════
// Page Analytics
// ══════════════════════════════════════════════════════════════

// @GET /api/website-intelligence/pages?websiteId&from&to
exports.getPages = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const { fromDate, toDate } = rangeToDates(from, to);
    const site = siteFilter(req);

    const pvMatch = { ...site, enteredAt: { $gte: fromDate, $lte: toDate } };
    const pageAgg = await WitPageview.aggregate([
      { $match: pvMatch },
      { $group: {
        _id: '$path',
        views: { $sum: 1 },
        visitors: { $addToSet: '$visitorId' },
        totalDuration: { $sum: '$duration' },
        totalScroll: { $sum: '$maxScrollDepth' },
      } },
    ]);

    const sessions = await WitSession.find({ ...site, startedAt: { $gte: fromDate, $lte: toDate } })
      .select('landingPage exitPage isBounce leadId').lean();

    const landingCounts = new Map(); // path -> { total, bounced, converted }
    sessions.forEach((s) => {
      const l = landingCounts.get(s.landingPage) || { total: 0, bounced: 0, converted: 0 };
      l.total += 1;
      if (s.isBounce) l.bounced += 1;
      if (s.leadId) l.converted += 1;
      landingCounts.set(s.landingPage, l);
    });
    const exitCounts = new Map();
    sessions.forEach((s) => exitCounts.set(s.exitPage, (exitCounts.get(s.exitPage) || 0) + 1));
    const totalPageviewsByPath = new Map(pageAgg.map((p) => [p._id, p.views]));

    const rows = pageAgg.map((p) => {
      const landing = landingCounts.get(p._id);
      const exits = exitCounts.get(p._id) || 0;
      return {
        path: p._id,
        views: p.views,
        uniqueVisitors: p.visitors.length,
        avgTimeOnPage: p.views ? round2(p.totalDuration / p.views) : 0,
        avgScrollDepth: p.views ? round2(p.totalScroll / p.views) : 0,
        bounceRate: landing && landing.total ? round2((landing.bounced / landing.total) * 100) : null,
        exitRate: totalPageviewsByPath.get(p._id) ? round2((exits / totalPageviewsByPath.get(p._id)) * 100) : 0,
        conversionRate: landing && landing.total ? round2((landing.converted / landing.total) * 100) : null,
      };
    }).sort((a, b) => b.views - a.views);

    res.json({ success: true, data: { range: { from, to }, pages: rows } });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════
// Landing Page Performance (session-level, not pageview-level)
// ══════════════════════════════════════════════════════════════

// @GET /api/website-intelligence/landing-pages?websiteId&from&to
exports.getLandingPages = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const { fromDate, toDate } = rangeToDates(from, to);
    const site = siteFilter(req);

    const sessions = await WitSession.find({ ...site, startedAt: { $gte: fromDate, $lte: toDate } })
      .select('sessionId visitorId landingPage isBounce duration leadId').lean();

    const sessionIds = sessions.map((s) => s.sessionId);
    const leads = await Lead.find({ websiteSessionId: { $in: sessionIds } }).select('websiteSessionId status dealValue').lean();
    const leadsBySession = new Map(leads.map((l) => [l.websiteSessionId, l]));

    const byPage = new Map();
    sessions.forEach((s) => {
      const b = byPage.get(s.landingPage) || { path: s.landingPage, visitors: new Set(), sessions: 0, bounced: 0, totalDuration: 0, leads: 0, revenue: 0 };
      b.visitors.add(s.visitorId);
      b.sessions += 1;
      if (s.isBounce) b.bounced += 1;
      b.totalDuration += s.duration || 0;
      const lead = leadsBySession.get(s.sessionId);
      if (lead) {
        b.leads += 1;
        if (lead.status === 'Won') b.revenue += lead.dealValue || 0;
      }
      byPage.set(s.landingPage, b);
    });

    const rows = Array.from(byPage.values()).map((b) => ({
      path: b.path,
      visitors: b.visitors.size,
      sessions: b.sessions,
      leads: b.leads,
      conversionRate: b.visitors.size ? round2((b.leads / b.visitors.size) * 100) : 0,
      revenue: round2(b.revenue),
      bounceRate: b.sessions ? round2((b.bounced / b.sessions) * 100) : 0,
      avgSessionDuration: b.sessions ? round2(b.totalDuration / b.sessions) : 0,
    })).sort((a, b) => b.visitors - a.visitors);

    res.json({ success: true, data: { range: { from, to }, landingPages: rows } });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════
// Form Analytics
// ══════════════════════════════════════════════════════════════

// @GET /api/website-intelligence/forms?websiteId&from&to
exports.getForms = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const { fromDate, toDate } = rangeToDates(from, to);
    const site = siteFilter(req);

    const events = await WitFormEvent.find({ ...site, createdAt: { $gte: fromDate, $lte: toDate } })
      .select('sessionId formId type fieldName fieldOrder createdAt').lean();

    const byForm = new Map();
    events.forEach((e) => {
      const f = byForm.get(e.formId) || {
        formId: e.formId, views: new Set(), starts: new Set(), submits: new Set(),
        sessionsSeen: new Map(), // sessionId -> { startTs, submitTs, lastFieldOrder, lastFieldName }
      };
      if (e.type === 'view') f.views.add(e.sessionId);
      if (e.type === 'start') f.starts.add(e.sessionId);
      if (e.type === 'submit') f.submits.add(e.sessionId);

      const s = f.sessionsSeen.get(e.sessionId) || {};
      if (e.type === 'start') s.startTs = e.createdAt;
      if (e.type === 'submit') s.submitTs = e.createdAt;
      if (e.type === 'field_blur') {
        if (s.lastFieldOrder === undefined || (e.fieldOrder ?? 0) >= s.lastFieldOrder) {
          s.lastFieldOrder = e.fieldOrder ?? 0;
          s.lastFieldName = e.fieldName;
        }
      }
      f.sessionsSeen.set(e.sessionId, s);
      byForm.set(e.formId, f);
    });

    const rows = Array.from(byForm.values()).map((f) => {
      const starts = f.starts.size;
      const submits = f.submits.size;
      const completionTimes = [];
      const dropoffs = new Map(); // fieldName -> count
      f.sessionsSeen.forEach((s, sessionId) => {
        if (s.startTs && s.submitTs) completionTimes.push((new Date(s.submitTs) - new Date(s.startTs)) / 1000);
        if (!f.submits.has(sessionId) && s.lastFieldName) {
          dropoffs.set(s.lastFieldName, (dropoffs.get(s.lastFieldName) || 0) + 1);
        }
      });
      return {
        formId: f.formId,
        views: f.views.size,
        starts,
        submissions: submits,
        abandonmentRate: starts ? round2(((starts - submits) / starts) * 100) : 0,
        avgCompletionTime: completionTimes.length ? round2(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) : null,
        fieldDropoffs: Array.from(dropoffs.entries()).map(([fieldName, count]) => ({ fieldName, count })).sort((a, b) => b.count - a.count),
      };
    }).sort((a, b) => b.views - a.views);

    res.json({ success: true, data: { range: { from, to }, forms: rows } });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════
// Funnel Analytics
// ══════════════════════════════════════════════════════════════

// @GET /api/website-intelligence/funnel?websiteId&from&to
exports.getFunnel = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const { fromDate, toDate } = rangeToDates(from, to);
    const site = siteFilter(req);

    const sessions = await WitSession.find({ ...site, startedAt: { $gte: fromDate, $lte: toDate } })
      .select('sessionId visitorId pageCount leadId').lean();
    const sessionIds = sessions.map((s) => s.sessionId);
    const sessionIdSet = new Set(sessionIds); // O(1) membership checks below, not O(n) Array#includes

    const formStartSessions = await WitFormEvent.distinct('sessionId', { ...site, type: 'start', createdAt: { $gte: fromDate, $lte: toDate } });
    const formSubmitSessions = await WitFormEvent.distinct('sessionId', { ...site, type: 'submit', createdAt: { $gte: fromDate, $lte: toDate } });

    const leads = await Lead.find({ websiteSessionId: { $in: sessionIds } }).select('status').lean();

    const visitors = new Set(sessions.map((s) => s.visitorId)).size;
    const engagedSessions = sessions.filter((s) => s.pageCount >= 2).length;
    const formStarted = formStartSessions.filter((id) => sessionIdSet.has(id)).length;
    const formSubmitted = formSubmitSessions.filter((id) => sessionIdSet.has(id)).length;
    const leadsCreated = leads.length;
    const qualified = leads.filter((l) => l.status !== 'New Lead').length;
    const won = leads.filter((l) => l.status === 'Won').length;

    const stages = [
      { stage: 'Visitors', count: visitors },
      { stage: 'Engaged Sessions', count: engagedSessions },
      { stage: 'Form Started', count: formStarted },
      { stage: 'Form Submitted', count: formSubmitted },
      { stage: 'Lead Created', count: leadsCreated },
      { stage: 'Qualified Lead', count: qualified },
      { stage: 'Customer', count: won },
    ];
    const withPct = stages.map((s, i) => ({
      ...s,
      pctOfTotal: visitors ? round2((s.count / visitors) * 100) : 0,
      pctOfPrevious: i === 0 ? 100 : (stages[i - 1].count ? round2((s.count / stages[i - 1].count) * 100) : 0),
    }));

    res.json({ success: true, data: { range: { from, to }, funnel: withPct } });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════
// Lead Attribution
// ══════════════════════════════════════════════════════════════

// @GET /api/website-intelligence/lead-attribution?websiteId&from&to&limit
exports.getLeadAttribution = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const { fromDate, toDate } = rangeToDates(from, to);
    const site = siteFilter(req);
    const limit = Math.min(200, Number(req.query.limit) || 100);

    const leads = await Lead.find({
      ...(site.websiteId ? { websiteId: site.websiteId } : { websiteId: { $ne: null } }),
      createdAt: { $gte: fromDate, $lte: toDate },
    })
      .populate('assignedTo', 'name')
      .populate('websiteId', 'name domain')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const visitorIds = leads.map((l) => l.websiteVisitorId).filter(Boolean);
    const visitors = await WitVisitor.find({ visitorId: { $in: visitorIds } }).select('visitorId firstSeenAt').lean();
    const firstSeenByVisitor = new Map(visitors.map((v) => [v.visitorId, v.firstSeenAt]));

    const rows = leads.map((l) => {
      const firstSeen = firstSeenByVisitor.get(l.websiteVisitorId);
      const timeToConversionHours = firstSeen ? round2((new Date(l.createdAt) - new Date(firstSeen)) / (1000 * 60 * 60)) : null;
      return {
        leadId: l._id,
        leadRef: l.leadId,
        companyName: l.companyName,
        contactPerson: l.contactPerson,
        status: l.status,
        dealValue: l.dealValue || 0,
        revenue: l.status === 'Won' ? (l.dealValue || 0) : 0,
        salesperson: l.assignedTo?.name || 'Unassigned',
        website: l.websiteId?.name || '',
        landingPageUrl: l.landingPageUrl,
        utmSource: l.utmSource, utmMedium: l.utmMedium, utmCampaign: l.utmCampaign,
        createdAt: l.createdAt,
        timeToConversionHours,
      };
    });

    res.json({ success: true, data: { range: { from, to }, leads: rows } });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════
// Repeat Visitors — how many times has the same individual come back
// ══════════════════════════════════════════════════════════════

const FREQUENCY_BUCKETS = [
  { key: '1', label: '1 visit', test: (n) => n === 1 },
  { key: '2-3', label: '2–3 visits', test: (n) => n >= 2 && n <= 3 },
  { key: '4-6', label: '4–6 visits', test: (n) => n >= 4 && n <= 6 },
  { key: '7+', label: '7+ visits', test: (n) => n >= 7 },
];

// @GET /api/website-intelligence/repeat-visitors?websiteId&from&to&limit
// "Visits in period" is computed fresh from sessions inside the selected
// date range (consistent with every other report on this page); "Lifetime
// Visits" is WitVisitor.totalSessions — a running total that predates the
// filter, shown alongside so both "engaged this period" and "engaged ever"
// are visible without them being confused for the same number.
exports.getRepeatVisitors = async (req, res, next) => {
  try {
    const { from, to } = resolveRange(req);
    const { fromDate, toDate } = rangeToDates(from, to);
    const site = siteFilter(req);
    const limit = Math.min(200, Number(req.query.limit) || 100);

    const sessions = await WitSession.find({ ...site, startedAt: { $gte: fromDate, $lte: toDate } })
      .select('visitorId startedAt deviceType browser country ip')
      .sort({ startedAt: -1 })
      .lean();

    // visitorId -> { visitsInRange, latestSession, visits: [{startedAt, ip}], ipSet }
    const byVisitor = new Map();
    sessions.forEach((s) => {
      const entry = byVisitor.get(s.visitorId);
      const visit = { startedAt: s.startedAt, ip: s.ip || '' };
      if (!entry) {
        byVisitor.set(s.visitorId, { visitsInRange: 1, latestSession: s, visits: [visit], ipSet: new Set(s.ip ? [s.ip] : []) });
      } else {
        entry.visitsInRange += 1; // sessions are pre-sorted desc, so the first one seen per visitor is already the latest
        entry.visits.push(visit);
        if (s.ip) entry.ipSet.add(s.ip);
      }
    });

    const visitorIds = Array.from(byVisitor.keys());
    const visitorDocs = await WitVisitor.find({ ...site, visitorId: { $in: visitorIds } })
      .select('visitorId totalSessions firstSeenAt lastSeenAt leadId')
      .lean();
    const visitorById = new Map(visitorDocs.map((v) => [v.visitorId, v]));

    const leadIds = visitorDocs.map((v) => v.leadId).filter(Boolean);
    const leads = await Lead.find({ _id: { $in: leadIds } }).select('companyName contactPerson status').lean();
    const leadById = new Map(leads.map((l) => [String(l._id), l]));

    const rows = Array.from(byVisitor.entries()).map(([visitorId, entry]) => {
      const vDoc = visitorById.get(visitorId);
      const lead = vDoc?.leadId ? leadById.get(String(vDoc.leadId)) : null;
      return {
        visitorId,
        visitsInRange: entry.visitsInRange,
        lifetimeVisits: vDoc?.totalSessions ?? entry.visitsInRange,
        firstSeenAt: vDoc?.firstSeenAt || null,
        lastSeenAt: vDoc?.lastSeenAt || entry.latestSession.startedAt,
        deviceType: entry.latestSession.deviceType,
        browser: entry.latestSession.browser,
        country: entry.latestSession.country,
        // Every visit in the selected range, most recent first — exact
        // timestamp + the IP that request came from — plus the deduplicated
        // set of IPs (a visitor's IP can change across visits: mobile data
        // vs wifi, VPN, a different location entirely).
        visits: entry.visits.map((v) => ({ at: v.startedAt, ip: v.ip })),
        uniqueIps: Array.from(entry.ipSet),
        lead: lead ? { leadId: vDoc.leadId, companyName: lead.companyName, contactPerson: lead.contactPerson, status: lead.status } : null,
      };
    }).sort((a, b) => b.visitsInRange - a.visitsInRange).slice(0, limit);

    const totalVisitorsInRange = byVisitor.size;
    const distribution = FREQUENCY_BUCKETS.map((b) => {
      const count = Array.from(byVisitor.values()).filter((e) => b.test(e.visitsInRange)).length;
      return { bucket: b.key, label: b.label, visitors: count, pct: totalVisitorsInRange ? round2((count / totalVisitorsInRange) * 100) : 0 };
    });

    res.json({ success: true, data: { range: { from, to }, distribution, visitors: rows } });
  } catch (err) { next(err); }
};
