const { Lead, Client, Project } = require('../models/index');
const User = require('../models/User');
const EmailLog = require('../models/EmailLog');
const CampaignLead = require('../models/CampaignLead');
const notifService = require('../services/notificationService');
const { addEmailToQueue, EMAIL_TYPES } = require('../queues/emailQueue');
const audit = require('../services/auditService');
const { autoAssignLead } = require('../utils/leadAssignment');
const { secretsMatch } = require('../utils/secretsMatch');

// Helper to calculate Lead Health Score dynamically
const calculateHealthScore = (lead) => {
  let score = 20; // Base score
  
  // 1. Interactions: +10 per interaction (max 30)
  score += Math.min(30, (lead.interactionsCount || 0) * 10);

  // 2. Website & Media: +5 per website visit (max 15), +5 per email open (max 15), +10 per proposal view (max 20)
  score += Math.min(15, (lead.websiteVisits || 0) * 5);
  score += Math.min(15, (lead.emailOpens || 0) * 5);
  score += Math.min(20, (lead.proposalViews || 0) * 10);

  // 3. Deal Value: +10 for deal value > $2,000, +20 for value > $5,000
  const value = lead.dealValue || 0;
  if (value >= 5000) {
    score += 20;
  } else if (value >= 2000) {
    score += 10;
  }

  // 4. Last Contact Freshness: +20 within 2 days, +10 within 5 days, -10 if > 5 days stuck
  const daysDiff = Math.floor((Date.now() - new Date(lead.lastContactDate).getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff <= 2) {
    score += 20;
  } else if (daysDiff <= 5) {
    score += 10;
  } else {
    score -= 10;
  }

  // 5. Repeat engagement override: opening a campaign email 3+ times is a
  // strong buying signal on its own — guarantee the Hot bucket (>=75) even
  // if other factors (deal value, recency) are still thin.
  if ((lead.emailOpens || 0) >= 3) {
    score = Math.max(score, 80);
  }

  return Math.min(100, Math.max(0, score));
};

// Helper: check SLA breaches and update records in-place
const autoCheckSLA = async (leads) => {
  const now = new Date();
  let updatedAny = false;
  
  for (const lead of leads) {
    if (lead.status === 'New Lead' && lead.slaDeadline && new Date(lead.slaDeadline) < now && !lead.slaBreached) {
      lead.slaBreached = true;
      lead.activities.push({
        type: 'sla',
        text: 'SLA breached: Lead was not responded to within the 2-hour window.',
        performedBy: 'System'
      });
      await lead.save();
      updatedAny = true;
    }
  }
  return updatedAny;
};

// Helper to parse @mentions in notes and trigger dispatches
const parseAndNotifyMentions = async (req, lead, noteText) => {
  const io = req.app.get('io');
  // Match @Word or @Word Word (greedy checks for names)
  const mentionMatches = noteText.match(/@([a-zA-Z0-9\s_]{3,30})(?=[^a-zA-Z0-9\s]|$)/g);
  if (!mentionMatches) return;

  const users = await User.find({ status: { $ne: 'deleted' } });
  
  for (const match of mentionMatches) {
    const rawName = match.substring(1).trim().toLowerCase();
    
    // Search matching user name or email prefix
    const targetUser = users.find(u => {
      const nameMatch = u.name.toLowerCase().includes(rawName);
      const emailMatch = u.email.toLowerCase().split('@')[0] === rawName;
      return nameMatch || emailMatch;
    });

    if (targetUser && String(targetUser._id) !== String(req.user?._id)) {
      await notifService.dispatch(io, {
        recipient: targetUser._id,
        sender: req.user?._id,
        type: 'lead_mentioned',
        title: 'You were mentioned in a lead note',
        message: `${req.user?.name || 'Someone'} tagged you in a note for "${lead.companyName}": "${noteText.substring(0, 50)}..."`,
        link: '/leads'
      });

      // Async email — non-blocking
      if (targetUser.email) {
        addEmailToQueue(targetUser.email, EMAIL_TYPES.LEAD_MENTIONED, {
          mentionedName: targetUser.name,
          authorName:    req.user?.name || 'A teammate',
          companyName:   lead.companyName,
          noteExcerpt:   noteText.substring(0, 120),
        }).catch(() => {});
      }
    }
  }
};

// @GET /api/leads
exports.getLeads = async (req, res, next) => {
  try {
    // Meta Ads leads are a reporting copy, not something agents work here —
    // they get worked in the main CRM, and rndCRM's own detail view for
    // them is Meta Ads → Lead Details, not the general pipeline. Excluded
    // by name here rather than by scoping the query to only known sources,
    // so any other source keeps showing up in the pipeline without needing
    // this list updated every time a new source gets added elsewhere.
    const leads = await Lead.find({ source: { $ne: 'Meta Ads' } }).populate('assignedTo', 'name email avatar color initials position');
    
    // Auto-update SLA breaches in the background
    await autoCheckSLA(leads);

    // Compute health scores on the fly for UI rendering
    const results = leads.map(l => {
      const obj = l.toObject();
      obj.healthScore = calculateHealthScore(l);
      if (!obj.leadId) {
        obj.leadId = `LD-${String(l._id).slice(-4).toUpperCase()}`;
      }
      return obj;
    });

    res.json({ success: true, data: results });
  } catch (err) { next(err); }
};

// @POST /api/leads
exports.createLead = async (req, res, next) => {
  try {
    const { companyName, contactPerson, email, phone, website, dealValue, status, assignedTo, contacts, source, nextFollowUpDate, tags, customFields, adAttribution, externalLeadId, externalAssignedToName } = req.body;

    // Idempotency guard — an automation (n8n workflow re-execution, a
    // trigger re-firing on the same row, a retry after a transient error)
    // can call this endpoint more than once for the same real lead.
    // Without this, every re-call creates another full duplicate of the
    // same person. Matching on externalLeadId (the main CRM's own ID for
    // this lead) and returning the EXISTING record — untouched — rather
    // than erroring, keeps the caller's flow simple (still gets a 2xx with
    // lead data back) and never clobbers whatever an agent has since done
    // with it (status changes, notes, assignment).
    if (externalLeadId) {
      const existing = await Lead.findOne({ externalLeadId }).populate('assignedTo', 'name email avatar color initials position');
      if (existing) {
        const enriched = existing.toObject();
        enriched.healthScore = calculateHealthScore(existing);
        if (!enriched.leadId) enriched.leadId = `LD-${String(existing._id).slice(-4).toUpperCase()}`;
        return res.status(200).json({ success: true, duplicate: true, data: enriched });
      }
    }

    // No explicit assignee — hand it to the Lead Distribution algorithm
    // configured in Settings > Lead Routing (round-robin / least-loaded /
    // off). Returns null if auto-distribution is off or nobody's eligible.
    const wasAutoAssigned = !assignedTo;
    const finalAssignee = assignedTo || await autoAssignLead();

    const lead = new Lead({
      companyName,
      contactPerson,
      email: email || '',
      phone: phone || '',
      website: website || '',
      dealValue: dealValue ? Number(dealValue) : 0,
      status: status || 'New Lead',
      source: source || 'Manual',
      assignedTo: finalAssignee || null,
      contacts: contacts || [],
      nextFollowUpDate: nextFollowUpDate || null,
      tags: tags || [],
      customFields: customFields || {},
      // Optional — n8n (or any external integration) can pass this so this
      // lead counts toward the right campaign/adset/ad in the Meta Ads
      // dashboard's attribution numbers. Silently ignored if platform isn't
      // a recognized value, rather than rejecting the whole lead over it.
      adAttribution: (adAttribution && ['meta', 'google'].includes(adAttribution.platform)) ? {
        platform: adAttribution.platform,
        campaignId: adAttribution.campaignId || '',
        campaignName: adAttribution.campaignName || '',
        adsetId: adAttribution.adsetId || '',
        adsetName: adAttribution.adsetName || '',
        adId: adAttribution.adId || '',
        adName: adAttribution.adName || '',
      } : undefined,
      // The main CRM's own ID for this same lead — lets a later status-sync
      // webhook find this record. Optional; leads created without it just
      // can't be status-synced later.
      externalLeadId: externalLeadId || undefined,
      externalAssignedToName: externalAssignedToName || '',
    });

    // Log creation activity
    lead.activities.push({
      type: 'create',
      text: `Lead created manually by ${req.user?.name || 'Administrator'}`,
      performedBy: req.user?.name || 'System'
    });
    if (wasAutoAssigned && finalAssignee) {
      lead.activities.push({
        type: 'assign',
        text: 'Auto-assigned via Lead Distribution rules',
        performedBy: 'System'
      });
    }

    await lead.save();
    
    const populated = await Lead.findById(lead._id).populate('assignedTo', 'name email avatar color initials position');
    const enriched = populated.toObject();
    enriched.healthScore = calculateHealthScore(populated);
    if (!enriched.leadId) {
      enriched.leadId = `LD-${String(populated._id).slice(-4).toUpperCase()}`;
    }

    // Broadcast socket creation
    const io = req.app.get('io');
    io?.emit('lead:created', enriched);

    audit.log(req, {
      action: 'create', category: 'lead',
      targetId: lead._id, targetModel: 'Lead',
      targetTitle: companyName,
      targetRef: enriched.leadId || '',
      metadata: { status: lead.status, assignedTo: finalAssignee ? String(finalAssignee) : null, autoAssigned: wasAutoAssigned && !!finalAssignee, dealValue: lead.dealValue },
    });

    // Notify assigned user (manually chosen or auto-assigned)
    if (finalAssignee && String(finalAssignee) !== String(req.user?._id)) {
      notifService.dispatch(io, {
        recipient: finalAssignee,
        sender: req.user?._id,
        type: 'lead_assigned',
        title: wasAutoAssigned ? 'New sales lead auto-assigned to you' : 'New sales lead assigned to you',
        message: wasAutoAssigned
          ? `A prospective B2B lead was auto-assigned to you via Lead Distribution rules: "${companyName}"`
          : `${req.user?.name} assigned you a prospective B2B lead: "${companyName}"`,
        link: '/leads'
      });

      // Async email — fire-and-forget (never blocks the response)
      // CC goes to the official company inbox so the team always has visibility.
      User.findById(finalAssignee).select('email name').then(rep => {
        if (rep?.email) {
          addEmailToQueue(rep.email, EMAIL_TYPES.LEAD_ASSIGNED, {
            assigneeName:  rep.name,
            assignerName:  wasAutoAssigned ? 'Lead Distribution (auto-assigned)' : req.user?.name,
            companyName,
            contactPerson: enriched.contactPerson,
            dealValue:     enriched.dealValue,
            status:        enriched.status,
          }, null, process.env.COMPANY_NOTIFICATION_EMAIL || process.env.EMAIL_FROM, lead._id).catch(() => {});
        }
      }).catch(() => {});
    }

    res.status(201).json({ success: true, data: enriched });
  } catch (err) { next(err); }
};

// Main CRM's own lead-status name → rndCRM Lead status. Replaces an earlier,
// wrong guess at this table (generic Vicidial disposition codes that don't
// actually match this system) with the real list the client pulled directly
// from their CRM's status settings, each already bucketed into one of 5
// categories (Not Confirmed / Lost / In Progress / Potential / Converted)
// that map cleanly 1:1 onto rndCRM's own 5 statuses. Kept server-side rather
// than in the n8n workflow so there's exactly one place to update if the
// client adds/renames a status, and n8n/the main CRM never need to know
// rndCRM's status vocabulary — they just forward whatever status name is on
// the lead.
//
// "In Progress" is a wide bucket (everything from a fresh callback to
// paperwork-stage names like "IVA Agreed"/"Full Docs Back") — mapped
// uniformly to First Contact rather than guessing per-name which are closer
// to a done deal. Only "Converted" (an actual confirmed win — IVA verified,
// pack back, PBS sold) maps to Won; only "Potential" (on hold, awaiting next
// step) maps to Proposal Sent. Revisit if finer granularity is wanted later.
const DISPOSITION_STATUS_MAP = {
  // NOT CONFIRMED — call happened but outcome isn't confirmed yet
  '3 WAY CALLS': 'New Lead', ALDMP: 'New Lead', DNC: 'New Lead',

  // LOST — disqualified, declined, or already handled elsewhere
  'ALREADY IN IVA': 'Lost', 'ALREADY IN TRUST DEED': 'Lost', CHARITY: 'Lost',
  'CHARITY DUPLICATE': 'Lost', 'CLAW BACK': 'Lost', DRO: 'Lost', 'HIGH DI': 'Lost',
  HOAX: 'Lost', 'HOME OWNER': 'Lost', IRATE: 'Lost', 'LANGUAGE BARRIER': 'Lost',
  'LOW DEBTS': 'Lost', 'LOW INCOME': 'Lost', 'NOT INTERESTED': 'Lost',
  'NOT STRUGGLING': 'Lost', 'PRIVATE TENANT': 'Lost', 'SIP FAILED': 'Lost',
  UNQUALIFIED: 'Lost',

  // IN PROGRESS — a real contact/engagement is happening, not yet resolved
  'ANSWERING MACHINE': 'First Contact', APPROVALS: 'First Contact',
  'AWAITING MORE DOCS': 'First Contact', 'AWAITING PICTURES': 'First Contact',
  'CALL BACK': 'First Contact', CHASE: 'First Contact',
  'CONTACTED OVER THE PHONE': 'First Contact', DMP: 'First Contact',
  'DMP AGREED': 'First Contact', 'DMP XFER': 'First Contact',
  "DOC'S BACK": 'First Contact', 'DUPLICATE LEAD': 'First Contact',
  'EMAIL / WHTATSAPP CHASED': 'First Contact', 'EXTERNAL LEAD': 'First Contact',
  'FULL DOCS BACK': 'First Contact', 'HANG UP HAS DEBTS': 'First Contact',
  'HAS DEBTS BUSY': 'First Contact', 'HAS DEBTS NOT INTERESTED': 'First Contact',
  'HOTKEY DONE': 'First Contact', 'IP QUERIES': 'First Contact',
  'IVA AGREED': 'First Contact', 'IVA XFER': 'First Contact', 'LEAD IN': 'First Contact',
  'MI NEEDED': 'First Contact', 'MI RESOLVED': 'First Contact', 'NO CONTACT': 'First Contact',
  'PART PACK BACK': 'First Contact', 'PICTURES RECEIVED': 'First Contact',
  'SENT TO CLEAR START': 'First Contact', 'SENT TO IP': 'First Contact',
  'SIP BOOKED': 'First Contact', 'STRUCTURE COMPLETED': 'First Contact',
  'TRYING RECONNECT': 'First Contact', 'VOICE MAIL / BUSY': 'First Contact',

  // POTENTIAL — on hold / awaiting the next step, still live
  'IVA HOLD': 'Proposal Sent', 'ON HOLD': 'Proposal Sent', 'PACK OUT': 'Proposal Sent',

  // CONVERTED — an actual confirmed win
  'IVA IN HOUSE VERIFIED': 'Won', 'PACK BACK': 'Won', 'PBS SOLD': 'Won', VERIFIED: 'Won',
};

// @GET /api/lead-sync/pending — called by the polling n8n workflow BEFORE it
// touches the main CRM, so it never has to fetch/filter that system's full
// lead list. Returns only leads rndCRM is still waiting to hear about: ones
// with an externalLeadId (created via the main CRM) whose status hasn't
// already reached a terminal state. Once a lead is Won or Lost it drops out
// of this list on its own — no further syncing needed, keeps the list from
// growing forever. Same shared-secret auth as the status-sync endpoint,
// passed as a query param since this is a GET.
exports.getPendingSyncLeads = async (req, res, next) => {
  try {
    const expectedSecret = process.env.LEAD_SYNC_WEBHOOK_SECRET;
    if (!expectedSecret || !secretsMatch(req.query.secret, expectedSecret)) {
      return res.status(401).json({ success: false, message: 'Invalid webhook secret' });
    }

    const leads = await Lead.find({
      externalLeadId: { $exists: true, $ne: '' },
      status: { $nin: ['Won', 'Lost'] },
    }).select('externalLeadId phone status').lean();

    res.json({
      success: true,
      // phone is included because the main CRM's lookup endpoint only
      // accepts id/uid/phone — not an arbitrary external ID string — so
      // that's what the caller needs to look this lead up over there.
      // externalLeadId travels back through unchanged, for the sync-back
      // call afterward (that one matches against rndCRM's own record, which
      // does know its externalLeadId).
      data: leads.map((l) => ({ externalLeadId: l.externalLeadId, phone: l.phone, status: l.status })),
    });
  } catch (err) { next(err); }
};

// @POST /api/lead-sync/status — called by the MAIN CRM's own backend (not a
// browser, no CRM user session), whenever a lead it owns changes status or
// deal value. rndCRM only ever sees a lead once at creation (via
// createLead's externalLeadId) — without this webhook, "Qualified Leads" /
// "Won Customers" / "Revenue" / "ROI" / "ROAS" in the Meta Ads dashboard
// would stay stuck at whatever the lead's status was the moment it was
// created, forever. Auth is a shared secret (LEAD_SYNC_WEBHOOK_SECRET),
// same pattern as witPublicController's apiSecret — fails closed if the
// env var isn't configured, rather than accepting an empty secret.
exports.syncLeadStatus = async (req, res, next) => {
  try {
    const { secret, externalLeadId, status: explicitStatus, disposition, dealValue, externalAssignedToName } = req.body || {};
    const expectedSecret = process.env.LEAD_SYNC_WEBHOOK_SECRET;
    if (!expectedSecret || !secretsMatch(secret, expectedSecret)) {
      return res.status(401).json({ success: false, message: 'Invalid webhook secret' });
    }
    if (!externalLeadId) {
      return res.status(400).json({ success: false, message: 'externalLeadId is required' });
    }

    const lead = await Lead.findOne({ externalLeadId });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'No rndCRM lead found with that externalLeadId' });
    }

    // Prefer an already-mapped status if the caller sends one explicitly;
    // otherwise resolve it from the raw Vicidial disposition code, so the
    // caller (n8n) never has to know rndCRM's status vocabulary at all.
    const VALID_STATUSES = ['New Lead', 'First Contact', 'Proposal Sent', 'Won', 'Lost'];
    let status = explicitStatus;
    if (status === undefined && disposition !== undefined) {
      const mapped = DISPOSITION_STATUS_MAP[String(disposition).toUpperCase().trim()];
      if (!mapped) {
        return res.status(400).json({ success: false, message: `Unrecognized disposition code: "${disposition}"` });
      }
      status = mapped;
    }

    const changes = [];
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `status must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      if (status !== lead.status) {
        changes.push(`status: ${lead.status} → ${status}${disposition ? ` (disposition: ${disposition})` : ''}`);
        lead.status = status;
      }
    }
    // Raw main-CRM status text, kept verbatim regardless of whether it moved
    // the collapsed `status` bucket — e.g. "IVA Agreed" -> "Full Docs Back"
    // are both First Contact, but reps should still see the exact stage.
    if (disposition !== undefined && disposition !== lead.externalStatusLabel) {
      changes.push(`stage: ${lead.externalStatusLabel || '(none)'} → ${disposition}`);
      lead.externalStatusLabel = disposition;
    }
    if (dealValue !== undefined) {
      const n = Number(dealValue);
      if (Number.isFinite(n) && n !== lead.dealValue) { changes.push(`dealValue: ${lead.dealValue} → ${n}`); lead.dealValue = n; }
    }
    if (externalAssignedToName !== undefined && externalAssignedToName !== lead.externalAssignedToName) {
      changes.push(`assigned agent: ${lead.externalAssignedToName || '(none)'} → ${externalAssignedToName}`);
      lead.externalAssignedToName = externalAssignedToName;
    }

    if (changes.length) {
      lead.activities.push({ type: 'status_change', text: `Synced from main CRM: ${changes.join(', ')}`, performedBy: 'System' });
      await lead.save();
    }

    res.json({
      success: true,
      data: {
        leadId: lead._id, status: lead.status, externalStatusLabel: lead.externalStatusLabel,
        dealValue: lead.dealValue, externalAssignedToName: lead.externalAssignedToName, changed: changes.length > 0,
      },
    });
  } catch (err) { next(err); }
};

// @GET /api/lead-sync/email-activity?email=<email>&secret=<secret>
// Read-only pull for the main CRM: given a lead's email, return everything
// rndCRM knows about outreach to that address — every campaign it was ever
// part of (verification, sends, opens, clicks, replies, unsubscribes, call
// requests) plus any one-off emails sent from the Lead detail page. Reverse
// direction of syncLeadStatus above (main CRM pushes status *in*; this pulls
// engagement *out*), same shared-secret auth.
//
// Lookup is by email, not externalLeadId — the main CRM's own record may not
// always carry rndCRM's internal ID, but it always knows the email. Lead.email
// has no uniqueness constraint in this schema (CSV imports/Web Form/Meta Ads
// leads can collide), so when more than one Lead shares the address this
// picks the most recently updated one as the "best match" rather than failing
// or guessing — see conversation/decision that landed on this over enforcing
// a hard-unique index (would need a data migration first).
//
// CampaignLead (the actual send/open/click/reply ledger) is the primary
// source, not Lead — a Lead document only exists here for addresses that
// converted (replied/hot) or were synced in from the main CRM, but most
// campaign recipients never cross that bar. Gating this endpoint on "a Lead
// exists" would 404 for the majority of real recipients the main CRM might
// ask about, so Lead is treated as optional enrichment (company/contact
// name, externalLeadId) layered on top of whatever CampaignLead/EmailLog
// activity is found — never a hard requirement to return data.
exports.getLeadEmailActivity = async (req, res, next) => {
  try {
    const { secret, email } = req.query;
    const expectedSecret = process.env.LEAD_SYNC_WEBHOOK_SECRET;
    if (!expectedSecret || !secretsMatch(secret, expectedSecret)) {
      return res.status(401).json({ success: false, message: 'Invalid webhook secret' });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    // Case-insensitive exact match — Lead.email isn't lowercased on save
    // (unlike CampaignLead.email, which is), so this can't just be a
    // straight equality lookup.
    const [lead, campaignLeads] = await Promise.all([
      Lead.findOne({
        email: { $regex: `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      }).sort({ updatedAt: -1 }),
      CampaignLead.find({ email: normalizedEmail })
        .populate('campaign', 'name status subject')
        .populate('accountUsed', 'email')
        .sort({ sentAt: -1 })
        .lean(),
    ]);

    const directEmails = lead
      ? await EmailLog.find({ leadId: lead._id }).sort({ sentAt: -1 }).limit(100).lean()
      : [];

    if (!lead && campaignLeads.length === 0 && directEmails.length === 0) {
      return res.status(404).json({ success: false, message: 'No email activity found for that email' });
    }

    const campaigns = campaignLeads
      .filter((cl) => cl.campaign) // drop rows whose campaign was hard-deleted
      .map((cl) => ({
        campaignId: cl.campaign._id,
        campaignName: cl.campaign.name,
        campaignStatus: cl.campaign.status,
        subject: cl.campaign.subject,
        status: cl.status,
        accountUsed: cl.accountUsed?.email || '',
        verification: {
          status: cl.verificationStatus,
          provider: cl.provider,
          verifiedAt: cl.verifiedAt,
        },
        engagement: {
          sentAt: cl.sentAt,
          openCount: cl.openCount,
          firstOpenedAt: cl.opens?.[0]?.at || null,
          lastOpenedAt: cl.openedAt,
          opens: cl.opens || [],
          clickCount: cl.clickCount,
          clicks: cl.clicks || [],
          repliedAt: cl.repliedAt,
          unsubscribedAt: cl.unsubscribedAt,
          callRequested: cl.callRequested,
          callRequestedAt: cl.callRequestedAt,
        },
      }));

    const lastEngagementAt = campaigns.reduce((latest, c) => {
      const candidates = [c.engagement.lastOpenedAt, c.engagement.repliedAt, c.engagement.sentAt].filter(Boolean);
      const campaignLatest = candidates.length ? new Date(Math.max(...candidates.map((d) => new Date(d)))) : null;
      if (!campaignLatest) return latest;
      return !latest || campaignLatest > latest ? campaignLatest : latest;
    }, null);

    res.json({
      success: true,
      data: {
        // lead is null when this address was only ever a campaign recipient
        // that never converted/synced into a Lead document here — see the
        // comment above the handler. Callers should treat it as optional.
        lead: lead
          ? {
              externalLeadId: lead.externalLeadId || '',
              email: lead.email,
              companyName: lead.companyName,
              contactPerson: lead.contactPerson,
            }
          : null,
        summary: {
          totalCampaigns: campaigns.length,
          totalEmailsSent: campaigns.filter((c) => c.engagement.sentAt).length + directEmails.length,
          totalOpens: campaigns.reduce((s, c) => s + (c.engagement.openCount || 0), 0),
          totalClicks: campaigns.reduce((s, c) => s + (c.engagement.clickCount || 0), 0),
          totalReplies: campaigns.filter((c) => c.engagement.repliedAt).length,
          lastEngagementAt,
          convertedFromCampaign: lead?.campaignAttribution?.id
            ? { id: lead.campaignAttribution.id, name: lead.campaignAttribution.name }
            : null,
        },
        campaigns,
        directEmails: directEmails.map((e) => ({
          subject: e.subject,
          sentAt: e.sentAt,
          status: e.status,
          messageId: e.messageId,
        })),
      },
    });
  } catch (err) { next(err); }
};

// @PUT /api/leads/:id
exports.updateLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const {
      companyName, contactPerson, email, phone, website, dealValue, status,
      assignedTo, watchers, contacts, noteText, websiteVisits, emailOpens, proposalViews, interactionsCount,
      nextFollowUpDate, tags, archived, customFields, source
    } = req.body;

    const io = req.app.get('io');
    const oldStatus = lead.status;
    const oldAssigned = lead.assignedTo;
    const oldSource = lead.source;

    // Apply values
    if (companyName !== undefined) lead.companyName = companyName;
    if (contactPerson !== undefined) lead.contactPerson = contactPerson;
    if (email !== undefined) lead.email = email;
    if (phone !== undefined) lead.phone = phone;
    if (website !== undefined) lead.website = website;
    if (dealValue !== undefined) lead.dealValue = Number(dealValue);
    if (watchers !== undefined) lead.watchers = watchers;
    if (contacts !== undefined) lead.contacts = contacts;
    if (nextFollowUpDate !== undefined) lead.nextFollowUpDate = nextFollowUpDate;
    if (tags !== undefined) lead.tags = tags;
    if (archived !== undefined) lead.archived = archived;
    if (source !== undefined && source !== oldSource) {
      lead.source = source;
      lead.activities.push({
        type: 'general',
        text: oldSource === 'Campaign' && source !== 'Campaign'
          ? 'Moved from Email Leads into the main B2B Leads Pipeline'
          : `Lead source changed from "${oldSource}" to "${source}"`,
        performedBy: req.user?.name || 'System'
      });
    }
    if (customFields !== undefined && typeof customFields === 'object') {
      Object.entries(customFields).forEach(([k, v]) => {
        lead.customFields.set(k, v);
      });
    }

    // Engagement incrementers
    if (websiteVisits !== undefined) lead.websiteVisits = Number(websiteVisits);
    if (emailOpens !== undefined) lead.emailOpens = Number(emailOpens);
    if (proposalViews !== undefined) lead.proposalViews = Number(proposalViews);
    if (interactionsCount !== undefined) lead.interactionsCount = Number(interactionsCount);

    // Status transition tracking
    if (status !== undefined && status !== oldStatus) {
      lead.status = status;
      lead.activities.push({
        type: 'status_change',
        text: `Lead stage changed from "${oldStatus}" to "${status}"`,
        performedBy: req.user?.name || 'System'
      });

      // Update interaction log
      lead.lastContactDate = new Date();

      // If Won: Complete Handshake (Auto create Client Profile & Project)
      if (status === 'Won') {
        let client = await Client.findOne({ name: { $regex: new RegExp(`^${lead.companyName.trim()}$`, 'i') } });
        if (!client) {
          client = await Client.create({
            name: lead.companyName,
            contact: lead.contactPerson,
            email: lead.email,
            phone: lead.phone,
            website: lead.website,
            budget: lead.dealValue ? `₹${lead.dealValue}` : '',
            status: 'active',
            paymentStatus: 'pending',
            createdBy: req.user?._id
          });
          
          lead.activities.push({
            type: 'general',
            text: `Automatically created Client Profile for "${client.name}" in workspace.`,
            performedBy: 'System'
          });

          io?.emit('client:created', client);
        }

        // Spin up a fresh project board
        const project = await Project.create({
          name: `${lead.companyName} Delivery Workspace`,
          description: `Automatically provisioned workspace initialized from won lead. B2B deal size: ₹${lead.dealValue || 0}.`,
          clientId: client._id,
          status: 'pending',
          budget: lead.dealValue ? `₹${lead.dealValue}` : '',
          createdBy: req.user?._id
        });

        lead.activities.push({
          type: 'general',
          text: `Automatically initialized Project delivery board "${project.name}" in database.`,
          performedBy: 'System'
        });

        io?.emit('project:created', project);

        // Broadcast celebration alert
        io?.emit('lead:won:alert', {
          companyName: lead.companyName,
          value: lead.dealValue,
          clientUrl: `/clients`
        });

        // Personal notification for the assigned rep
        const wonRecipient = lead.assignedTo || req.user?._id;
        if (wonRecipient && String(wonRecipient) !== String(req.user?._id)) {
          notifService.dispatch(io, {
            recipient: wonRecipient,
            sender:    req.user?._id,
            type:      'lead_won',
            priority:  'success',
            title:     '🏆 Deal Won!',
            message:   `${lead.companyName} has been converted into a client (₹${(lead.dealValue || 0).toLocaleString('en-IN')})`,
            link:      '/clients',
          });
        }

        // Email the assigned rep (or the person who closed it) — non-blocking
        const recipientId = lead.assignedTo || req.user?._id;
        if (recipientId) {
          User.findById(recipientId).select('email name').then(rep => {
            if (rep?.email) {
              addEmailToQueue(rep.email, EMAIL_TYPES.LEAD_WON, {
                companyName:   lead.companyName,
                contactPerson: lead.contactPerson,
                dealValue:     lead.dealValue,
                assigneeName:  rep.name,
                closedBy:      req.user?.name,
                clientUrl:     (process.env.CLIENT_URL || '') + '/clients',
              }, null, process.env.COMPANY_NOTIFICATION_EMAIL || process.env.EMAIL_FROM, lead._id).catch(() => {});
            }
          }).catch(() => {});
        }
      }
    }

    // Assigned To reassignment tracking
    if (assignedTo !== undefined && String(assignedTo) !== String(oldAssigned)) {
      lead.assignedTo = assignedTo || null;
      const staff = assignedTo ? await User.findById(assignedTo).select('name email') : null;
      
      lead.activities.push({
        type: 'assign',
        text: staff ? `Assigned lead to sales representative "${staff.name}"` : 'Removed sales representative assignment',
        performedBy: req.user?.name || 'System'
      });

      // Notify the newly assigned rep
      if (assignedTo && String(assignedTo) !== String(req.user?._id)) {
        notifService.dispatch(io, {
          recipient: assignedTo,
          sender: req.user?._id,
          type: 'lead_assigned',
          title: 'Lead reassigned to you',
          message: `${req.user?.name} reassigned B2B sales lead: "${lead.companyName}"`,
          link: '/leads'
        });

        // Async email — non-blocking; CC keeps company inbox in the loop
        if (staff?.email) {
          addEmailToQueue(staff.email, EMAIL_TYPES.LEAD_ASSIGNED, {
            assigneeName:  staff.name,
            assignerName:  req.user?.name,
            companyName:   lead.companyName,
            contactPerson: lead.contactPerson,
            dealValue:     lead.dealValue,
            status:        lead.status,
          }, null, process.env.COMPANY_NOTIFICATION_EMAIL || process.env.EMAIL_FROM, lead._id).catch(() => {});
        }
      }
    }

    // Add note and parse mentions
    if (noteText && noteText.trim()) {
      const noteObj = {
        text: noteText.trim(),
        author: req.user?._id,
        authorName: req.user?.name || 'System',
        createdAt: new Date()
      };
      lead.notes.push(noteObj);
      
      lead.activities.push({
        type: 'note',
        text: `Logged a timeline note: "${noteText.substring(0, 60)}..."`,
        performedBy: req.user?.name || 'System'
      });

      // Update interaction log
      lead.lastContactDate = new Date();
      lead.interactionsCount = (lead.interactionsCount || 0) + 1;

      // Handle @mentions
      await parseAndNotifyMentions(req, lead, noteText);

      // Notify watchers
      if (lead.watchers && lead.watchers.length > 0) {
        lead.watchers.forEach(watcherId => {
          if (String(watcherId) !== String(req.user?._id)) {
            notifService.dispatch(io, {
              recipient: watcherId,
              sender: req.user?._id,
              type: 'new_comment',
              title: `Watcher update: ${lead.companyName}`,
              message: `${req.user?.name} added a note on watched lead: "${noteText.substring(0, 40)}..."`,
              link: '/leads'
            });
          }
        });
      }
    }

    await lead.save();

    const populated = await Lead.findById(lead._id).populate('assignedTo', 'name email avatar color initials position');
    const enriched = populated.toObject();
    enriched.healthScore = calculateHealthScore(populated);
    if (!enriched.leadId) {
      enriched.leadId = `LD-${String(populated._id).slice(-4).toUpperCase()}`;
    }

    // Broadcast update
    io?.emit('lead:updated', enriched);

    // Lead Lost notification
    if (status === 'Lost' && oldStatus !== 'Lost') {
      const lostRecipient = lead.assignedTo || req.user?._id;
      if (lostRecipient && String(lostRecipient) !== String(req.user?._id)) {
        notifService.dispatch(io, {
          recipient: lostRecipient, sender: req.user?._id,
          type: 'lead_lost', priority: 'warning',
          title: 'Lead Marked as Lost',
          message: `${lead.companyName} has been marked as lost.`,
          link: '/leads',
        });
      }
    }

    // Determine the most specific audit action
    const leadAction = (() => {
      if (status !== undefined && status !== oldStatus) return 'status_change';
      if (assignedTo !== undefined && String(assignedTo) !== String(oldAssigned)) return 'assign';
      return 'update';
    })();
    audit.log(req, {
      action: leadAction, category: 'lead',
      targetId: lead._id, targetModel: 'Lead',
      targetTitle: lead.companyName,
      targetRef: enriched.leadId || '',
      metadata: {
        ...(leadAction === 'status_change' ? { statusFrom: oldStatus, statusTo: status } : {}),
        ...(leadAction === 'assign' ? { assignedTo: assignedTo || null } : {}),
      },
    });

    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
};

// @POST /api/leads/:id/email  — send a real outbound email to the lead contact
exports.sendLeadEmail = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const { subject, body } = req.body;
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, message: 'Subject and body are required' });
    }

    const recipientEmail = lead.email;
    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: 'This lead has no email address on file' });
    }

    // Queue the email — returns immediately, worker delivers asynchronously
    const jobId = await addEmailToQueue(
      recipientEmail,
      EMAIL_TYPES.OUTBOUND_EMAIL,
      {
        senderName:  req.user?.name,
        companyName: lead.companyName,
        subject:     subject.trim(),
        bodyText:    body.trim(),
      },
      req.user?._id?.toString(),  // triggeredBy
      null,                       // cc — outbound emails don't CC company
      lead._id                    // leadId for email log
    );

    // Log the send event on the lead timeline
    lead.activities.push({
      type:        'note',
      text:        `[📧 Outbound Email Queued] To: ${recipientEmail} · Subject: "${subject.trim()}"`,
      performedBy: req.user?.name || 'System',
    });
    lead.lastContactDate    = new Date();
    lead.interactionsCount  = (lead.interactionsCount || 0) + 1;
    await lead.save();

    const io = req.app.get('io');
    io?.emit('lead:updated', lead.toObject());

    audit.log(req, {
      action: 'email_sent', category: 'lead',
      targetId: lead._id, targetModel: 'Lead',
      targetTitle: lead.companyName,
      metadata: { to: recipientEmail, subject: subject.trim(), jobId },
    });

    res.json({ success: true, message: `Email queued for delivery to ${recipientEmail}`, jobId });
  } catch (err) { next(err); }
};

// @DELETE /api/leads/:id
exports.deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const leadRef = `LD-${String(lead._id).slice(-4).toUpperCase()}`;
    await Lead.findByIdAndDelete(req.params.id);

    const io = req.app.get('io');
    io?.emit('lead:deleted', req.params.id);

    audit.log(req, {
      action: 'delete', category: 'lead',
      targetId: req.params.id, targetModel: 'Lead',
      targetTitle: lead.companyName, targetRef: leadRef,
    });

    res.json({ success: true, message: 'Lead deleted from database.' });
  } catch (err) { next(err); }
};

// @POST /api/leads/merge
exports.mergeLeads = async (req, res, next) => {
  try {
    const { targetLeadId, sourceLeadId } = req.body;
    
    const target = await Lead.findById(targetLeadId);
    const source = await Lead.findById(sourceLeadId);
    
    if (!target || !source) {
      return res.status(404).json({ success: false, message: 'Both target and source leads must exist' });
    }

    // 1. Merge values: set to max value
    target.dealValue = Math.max(target.dealValue || 0, source.dealValue || 0);

    // 2. Merge emails/phones/websites if missing on target
    if (!target.email && source.email) target.email = source.email;
    if (!target.phone && source.phone) target.phone = source.phone;
    if (!target.website && source.website) target.website = source.website;

    // 3. Merge contacts list safely
    const existingEmails = new Set(target.contacts.map(c => c.email.toLowerCase()).filter(Boolean));
    source.contacts.forEach(sc => {
      if (!sc.email || !existingEmails.has(sc.email.toLowerCase())) {
        target.contacts.push(sc);
        if (sc.email) existingEmails.add(sc.email.toLowerCase());
      }
    });

    // 4. Merge timeline notes
    source.notes.forEach(sn => {
      target.notes.push({
        text: `[Merged from ${source.companyName}] ${sn.text}`,
        author: sn.author,
        authorName: sn.authorName,
        createdAt: sn.createdAt
      });
    });

    // 5. Merge activities history
    source.activities.forEach(sa => {
      target.activities.push({
        type: sa.type,
        text: `[Merged from ${source.companyName}] ${sa.text}`,
        performedBy: sa.performedBy,
        createdAt: sa.createdAt
      });
    });

    // Merge engagement counters
    target.interactionsCount = (target.interactionsCount || 0) + (source.interactionsCount || 0);
    target.websiteVisits = (target.websiteVisits || 0) + (source.websiteVisits || 0);
    target.emailOpens = (target.emailOpens || 0) + (source.emailOpens || 0);
    target.proposalViews = (target.proposalViews || 0) + (source.proposalViews || 0);

    target.activities.push({
      type: 'general',
      text: `Merged duplicate lead "${source.companyName}" into this account timeline`,
      performedBy: req.user?.name || 'System'
    });

    await target.save();
    await Lead.findByIdAndDelete(sourceLeadId);

    const io = req.app.get('io');
    
    // Broadcast delete event for merged lead, update for remaining lead
    io?.emit('lead:deleted', sourceLeadId);
    
    const populated = await Lead.findById(target._id).populate('assignedTo', 'name email avatar color initials position');
    const enriched = populated.toObject();
    enriched.healthScore = calculateHealthScore(populated);
    io?.emit('lead:updated', enriched);

    res.json({ success: true, message: 'Leads successfully merged.', data: enriched });
  } catch (err) { next(err); }
};

// @POST /api/leads/bulk
exports.bulkCreateLeads = async (req, res, next) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ success: false, message: 'Payload must contain leads array' });
    }

    // Programmatically calculate sequential leadId values to ensure CSV imports are aligned
    const nextNum = await Lead.getNextLeadNumber();

    const prepared = [];
    for (let index = 0; index < leads.length; index++) {
      const l = leads[index];
      // Rows with no assignee in the CSV go through the same Lead
      // Distribution rules as any other unassigned lead.
      const wasAutoAssigned = !l.assignedTo;
      const finalAssignee = l.assignedTo || await autoAssignLead();

      const activities = [{
        type: 'create',
        text: `Lead imported in bulk from CSV by ${req.user?.name || 'Administrator'}`,
        performedBy: req.user?.name || 'System'
      }];
      if (wasAutoAssigned && finalAssignee) {
        activities.push({ type: 'assign', text: 'Auto-assigned via Lead Distribution rules', performedBy: 'System' });
      }

      prepared.push({
        leadId: `LD-${nextNum + index}`,
        companyName: l.companyName || 'Unnamed B2B Lead',
        contactPerson: l.contactPerson || 'Undecided',
        email: l.email || '',
        phone: l.phone || '',
        website: l.website || '',
        dealValue: l.dealValue ? Number(l.dealValue) : 0,
        status: l.status || 'New Lead',
        source: 'Import',
        assignedTo: finalAssignee || null,
        nextFollowUpDate: l.nextFollowUpDate || null,
        tags: l.tags || [],
        customFields: l.customFields || {},
        activities
      });
    }

    const created = await Lead.insertMany(prepared);

    // Populate assignee and calculate scores for each lead
    const populated = await Lead.populate(created, { path: 'assignedTo', select: 'name email avatar color initials position' });
    
    const results = populated.map(l => {
      const obj = l.toObject();
      obj.healthScore = calculateHealthScore(l);
      return obj;
    });

    // Broadcast socket created event for each new lead
    const io = req.app.get('io');
    results.forEach(enriched => {
      io?.emit('lead:created', enriched);
    });

    res.status(201).json({ success: true, count: results.length, data: results });
  } catch (err) { next(err); }
};

// @GET /api/leads/:id/emails  — full email history for a lead
exports.getLeadEmails = async (req, res, next) => {
  try {
    const logs = await EmailLog.find({ leadId: req.params.id })
      .sort({ sentAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
};
