import { useState } from 'react';
import { X, BookOpen, Info, KeyRound, AlertTriangle, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../utils/helpers';
import api from '../services/api';

// In-app reference for whoever is creating/using an rndCRM API key —
// mirrors the main CRM's own "API Integration Documentation" panel
// (Admin → API Keys there), so both CRMs document their external API the
// same way. Content is data-driven (ENDPOINT_GROUPS below) so a new
// external-api domain (campaign sync, todo sync, ...) is a new group in
// this array, not a new component — see backend/src/external-api/README.md
// for the matching backend-side steps.
const GETTING_STARTED = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'auth', label: 'Authentication', icon: KeyRound },
  { id: 'codes', label: 'Response Codes', icon: AlertTriangle },
];

// One group per external-api domain. rndCRM's API keys are NOT scoped to a
// single domain — any valid key works on every group below, today and as
// more are added (see backend/src/external-api/README.md, "Key scoping").
const ENDPOINT_GROUPS = [
  {
    domain: 'LEAD SYNC',
    basePath: '/api/lead-sync',
    endpoints: [
      {
        id: 'ep-pending',
        method: 'GET',
        path: '/api/lead-sync/pending',
        name: 'Get Pending Sync Leads',
        description: 'Leads rndCRM created (web-form capture, Meta Ads, or a campaign conversion) that carry an externalLeadId from a previous sync but haven’t reached a terminal status yet. Poll this before pushing status updates so you don’t have to fetch/filter your entire lead list — once a lead is Won or Lost it drops off this list on its own.',
        params: [
          { name: 'secret', location: 'query', required: true, notes: 'API key' },
        ],
        example: {
          request: `GET /api/lead-sync/pending?secret=<your key>`,
          response: `{
  "success": true,
  "data": [
    { "externalLeadId": "MAINCRM-8841", "phone": "+44 7700 900123", "status": "First Contact" },
    { "externalLeadId": "MAINCRM-9012", "phone": "+44 7700 900456", "status": "New Lead" }
  ]
}`,
        },
        errors: [],
      },
      {
        id: 'ep-status',
        method: 'POST',
        path: '/api/lead-sync/status',
        name: 'Push Lead Status',
        description: 'Called whenever a lead’s status, deal value, or assigned agent changes in the main CRM. Without this, rndCRM’s own dashboards (Qualified Leads, Won Customers, Revenue, ROI/ROAS) stay stuck at whatever the lead’s status was the moment rndCRM first saw it. Send either status or disposition, not both — status wins if both are present.',
        params: [
          { name: 'secret', location: 'body', required: true, notes: 'API key' },
          { name: 'externalLeadId', location: 'body', required: true, notes: 'Must match a lead rndCRM already knows' },
          { name: 'status', location: 'body', required: 'status OR disposition', notes: 'One of: New Lead, First Contact, Proposal Sent, Won, Lost' },
          { name: 'disposition', location: 'body', required: 'status OR disposition', notes: 'Your CRM’s own raw status name — rndCRM maps it internally and stores it verbatim as externalStatusLabel' },
          { name: 'dealValue', location: 'body', required: false, notes: 'Number' },
          { name: 'externalAssignedToName', location: 'body', required: false, notes: 'Display-only agent name' },
        ],
        example: {
          request: `POST /api/lead-sync/status
{
  "secret": "<your key>",
  "externalLeadId": "MAINCRM-8841",
  "disposition": "IVA Agreed",
  "dealValue": 4500,
  "externalAssignedToName": "DebtFree Path"
}`,
          response: `{
  "success": true,
  "data": {
    "leadId": "64f1a2b3c4d5e6f7a8b9c0d1",
    "status": "First Contact",
    "externalStatusLabel": "IVA Agreed",
    "dealValue": 4500,
    "externalAssignedToName": "DebtFree Path",
    "changed": true
  }
}`,
        },
        errors: [
          { status: 400, cause: 'Missing externalLeadId, unrecognized disposition, or status not one of the 5 valid values' },
          { status: 404, cause: 'No rndCRM lead has that externalLeadId' },
        ],
      },
      {
        id: 'ep-email-activity',
        method: 'GET',
        path: '/api/lead-sync/email-activity',
        name: 'Get Lead Email Activity',
        description: 'Pulls everything rndCRM knows about outreach to an email address: every campaign it received (verification, send/open/click/reply/unsubscribe timestamps, "Request a Call" clicks) plus one-off emails sent from that lead’s detail page. Meant to be called on-demand (e.g. when an agent opens the lead in the main CRM), not cached — it reflects live tracking data. Doesn’t require the email to belong to a converted Lead record: data.lead is null when the address was only ever a campaign recipient.',
        params: [
          { name: 'secret', location: 'query', required: true, notes: 'API key' },
          { name: 'email', location: 'query', required: true, notes: 'Looked up case-insensitively' },
        ],
        example: {
          request: `GET /api/lead-sync/email-activity?email=john@acme.com&secret=<your key>`,
          response: `{
  "success": true,
  "data": {
    "lead": {
      "externalLeadId": "MAINCRM-8841",
      "email": "john@acme.com",
      "companyName": "Acme Corp",
      "contactPerson": "John Smith"
    },
    "summary": {
      "totalCampaigns": 2,
      "totalEmailsSent": 3,
      "totalOpens": 5,
      "totalClicks": 1,
      "totalReplies": 1,
      "lastEngagementAt": "2026-07-30T11:12:00.000Z",
      "convertedFromCampaign": { "id": "64f1a2b3c4d5e6f7a8b9c0d1", "name": "Q3 Debt Relief Outreach" }
    },
    "campaigns": [ { "campaignId": "...", "campaignName": "...", "status": "replied", "verification": {...}, "engagement": {...} } ],
    "directEmails": [ { "subject": "...", "sentAt": "...", "status": "sent", "messageId": "..." } ]
  }
}`,
        },
        errors: [
          { status: 400, cause: 'Missing email' },
          { status: 404, cause: 'Nothing found anywhere — no Lead, no campaign sends, no direct emails for that address' },
        ],
      },
    ],
  },
  {
    domain: 'LEAD CAPTURE',
    basePath: '/api/lead-capture',
    // API key OPTIONAL, not absent — a frontend-only site's own form JS has
    // nowhere safe to keep a secret and calls this anonymously; a site
    // proxying through its own serverless function (e.g. a Netlify
    // Function) can send a real key instead and skips the rate limit. No
    // origin restriction either way — meant to work from any number of
    // external sites with zero registration step. See the "Auth models"
    // section in backend/src/external-api/README.md.
    optionalAuth: true,
    endpoints: [
      {
        id: 'ep-lead-capture',
        method: 'POST',
        path: '/api/lead-capture/:source',
        name: 'Submit a Lead',
        description: 'Intake meant to be droppable into any number of external sites with zero registration step, no origin restriction. The API key is OPTIONAL: omit it entirely for a frontend-only site with nowhere safe to hold one (falls back to rate limit + honeypot); send it for a site that proxies through its own backend/serverless function (e.g. a Netlify Function) — a valid key exempts the request from the rate limit. :source is a free-form label (optionally mapped to a nicer display name in leadCapture/sources.js), not a credential either way. Creates the lead with source "Web Form", immediately visible in the normal Leads Pipeline.',
        params: [
          { name: 'name', location: 'body', required: true, notes: 'Full name of the person filling the form' },
          { name: 'email', location: 'body', required: false, notes: '' },
          { name: 'phone', location: 'body', required: false, notes: '' },
          { name: 'dealValue', location: 'body', required: false, notes: 'Number' },
          { name: 'companyName', location: 'body', required: false, notes: 'Only if the form actually collects one — falls back to name (this is for personal/consumer leads, not B2B)' },
          { name: 'secret', location: 'body', required: false, notes: 'API key, only if this caller has one. Omit entirely for a caller with nowhere safe to hold one — that\'s a normal, expected request, not an error.' },
          { name: 'website', location: 'body', required: false, notes: 'Honeypot — leave out of the visible form entirely. If a bot fills it, the submission is silently accepted but no lead is created.' },
        ],
        example: {
          request: `// No key — frontend-only site
POST /api/lead-capture/debtfreepath
{
  "name": "Jordan Smith",
  "email": "jordan@example.com",
  "phone": "+44 7700 900123"
}

// With a key — server-side caller (e.g. a Netlify Function)
POST /api/lead-capture/debtfreepath
{
  "name": "Jordan Smith",
  "email": "jordan@example.com",
  "phone": "+44 7700 900123",
  "secret": "rndcrm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}`,
          response: `{
  "success": true,
  "data": { "leadId": "64f1a2b3c4d5e6f7a8b9c0d1", "leadRef": "LD-1042" }
}`,
        },
        errors: [
          { status: 400, cause: 'Missing name' },
          { status: 401, cause: 'A secret was sent but doesn\'t match any active key (a missing secret is not an error — that\'s the anonymous path)' },
          { status: 429, cause: 'Rate limit exceeded (20 requests/minute per IP) — never triggers for a request authenticated with a valid key' },
        ],
      },
    ],
  },
  // Next domain (e.g. Campaign Sync) is a new object in this array —
  // see backend/src/external-api/README.md for the matching backend steps.
];

const ALL_ENDPOINTS = ENDPOINT_GROUPS.flatMap((g) => g.endpoints);

const STATUS_CODES = [
  { code: '200 OK',              type: 'Success',    desc: 'Request succeeded.' },
  { code: '201 Created',         type: 'Success',    desc: 'Record was created (e.g. a lead).' },
  { code: '400 Bad Request',     type: 'Client Error', desc: 'Missing or invalid parameter.' },
  { code: '401 Unauthorized',    type: 'Auth Error', desc: 'Required key missing/invalid/revoked (Lead Sync) — or, on Lead Capture, a key WAS sent but didn’t match (a missing key there is not an error).' },
  { code: '404 Not Found',       type: 'Client Error', desc: 'The referenced record doesn’t exist.' },
  { code: '429 Too Many Requests', type: 'Rate Limit', desc: 'Exceeded the request cap. (Lead Capture, anonymous requests only — a valid key exempts a request from this.)' },
  { code: '500 Server Error',    type: 'Server Error', desc: 'Unexpected failure — check rndCRM’s own logs.' },
];

function MethodBadge({ method }) {
  return (
    <span className={cn('badge text-[10.5px] font-bold px-2 py-0.5', method === 'GET' ? 'badge-info' : 'badge-success')}>
      {method}
    </span>
  );
}

function CodeBlock({ children, onCopy }) {
  return (
    <div className="relative group">
      <pre className="text-[12px] bg-slate-900 text-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{children}</pre>
      <button
        onClick={onCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy"
      >
        <Copy size={12} />
      </button>
    </div>
  );
}

function OverviewContent() {
  return (
    <div className="space-y-4 text-[13.5px] text-slate-600 dark:text-slate-350 leading-relaxed">
      <p>
        rndCRM's <strong className="text-slate-850 dark:text-slate-200">External API</strong> is how outside
        systems — today, the main CRM's own backend — read and write data here. It's a general-purpose
        surface, not tied to any one feature: <strong className="text-slate-850 dark:text-slate-200">Lead Sync</strong> is
        the first domain built on it, and more (Campaign Sync, Todo Sync, Task Sync, ...) will appear as their
        own groups in the Endpoints list below as they're added, using the same keys and the same auth.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
          <p className="text-[11px] font-bold text-slate-450 uppercase tracking-widest mb-1">Base URL</p>
          <code className="text-[12.5px] text-slate-800 dark:text-slate-200">{api.defaults.baseURL}</code>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
          <p className="text-[11px] font-bold text-slate-450 uppercase tracking-widest mb-1">Content-Type</p>
          <code className="text-[12.5px] text-slate-800 dark:text-slate-200">application/json</code>
        </div>
      </div>
      <p>
        Every endpoint accepts an API key — see <strong className="text-slate-850 dark:text-slate-200">Authentication</strong>.
        One key currently grants access to <em>every</em> domain below; there's no per-domain scoping yet.
        Lead Sync <em>requires</em> a key; Lead Capture accepts one but doesn't require it, since some of its
        callers have nowhere safe to hold one — see Authentication for the difference.
      </p>
    </div>
  );
}

function AuthContent() {
  return (
    <div className="space-y-4 text-[13.5px] text-slate-600 dark:text-slate-350 leading-relaxed">
      <p>
        Two different models, depending on the domain. <strong className="text-slate-850 dark:text-slate-200">Lead Sync</strong> requires
        an API key, created from this page (<strong className="text-slate-850 dark:text-slate-200">API Keys → Create API Key</strong>).
        The key is shown <strong className="text-slate-850 dark:text-slate-200">exactly once</strong>, at creation —
        copy it into the calling system's own server-side config immediately. rndCRM never stores or re-displays
        the raw value again, only a one-way hash.
      </p>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr>
              <th className="text-left font-bold text-slate-500 uppercase tracking-wider px-3 py-2 text-[10.5px]">Request Type</th>
              <th className="text-left font-bold text-slate-500 uppercase tracking-wider px-3 py-2 text-[10.5px]">Where "secret" goes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr><td className="px-3 py-2 font-mono text-[11.5px]">GET</td><td className="px-3 py-2">Query string — <code>?secret=&lt;key&gt;</code></td></tr>
            <tr><td className="px-3 py-2 font-mono text-[11.5px]">POST</td><td className="px-3 py-2">JSON body — <code>{'{ "secret": "<key>", ... }'}</code></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        <strong className="text-slate-850 dark:text-slate-200">Lead Capture's key is optional, and there's no
        origin restriction either way.</strong> Some of its callers (a frontend-only site's own browser JS) have
        nowhere safe to hold a secret — for them, omit <code>secret</code> entirely and the request still works,
        subject to a rate limit and a honeypot field instead of a credential. Other callers (a site proxying its
        form through its own backend/serverless function, e.g. a Netlify Function) genuinely can hold a key —
        send it the same way as Lead Sync, and it's checked the same way: valid → authenticated and exempt from
        the rate limit; invalid/revoked → <code>401</code>, never silently treated as "no key". See the Lead
        Capture endpoint for details.
      </p>
      <ul className="list-disc list-outside pl-5 space-y-1.5">
        <li>Store the key in the calling system's own environment config — <strong>never</strong> in frontend/browser code.</li>
        <li>Revoke a key any time from this page. A revoked key gets <code>401</code> on its very next request, no grace period.</li>
        <li>The key currently travels as a query-string parameter on GET requests, which can end up in server/proxy access logs — acceptable on a trusted network, worth revisiting (header-based auth) before crossing an untrusted one.</li>
      </ul>
    </div>
  );
}

function CodesContent() {
  return (
    <div className="space-y-4">
      <p className="text-[13.5px] text-slate-600 dark:text-slate-350">
        Every error response has the same shape: <code className="text-[12px]">{'{ "success": false, "message": "..." }'}</code>
      </p>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr>
              <th className="text-left font-bold text-slate-500 uppercase tracking-wider px-3 py-2.5 text-[10.5px]">Status Code</th>
              <th className="text-left font-bold text-slate-500 uppercase tracking-wider px-3 py-2.5 text-[10.5px]">Type</th>
              <th className="text-left font-bold text-slate-500 uppercase tracking-wider px-3 py-2.5 text-[10.5px]">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {STATUS_CODES.map((c) => (
              <tr key={c.code}>
                <td className="px-3 py-2.5 font-mono text-[11.5px] font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{c.code}</td>
                <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{c.type}</td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-350">{c.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EndpointContent({ ep, onCopy }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <MethodBadge method={ep.method} />
          <code className="text-[13px] text-slate-800 dark:text-slate-200 font-semibold">{ep.path}</code>
        </div>
        <p className="text-[13.5px] text-slate-600 dark:text-slate-350 leading-relaxed">{ep.description}</p>
      </div>

      {ep.params.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-450 uppercase tracking-widest mb-2">Parameters</p>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="text-left font-bold text-slate-500 uppercase tracking-wider px-3 py-2 text-[10.5px]">Field</th>
                  <th className="text-left font-bold text-slate-500 uppercase tracking-wider px-3 py-2 text-[10.5px]">Location</th>
                  <th className="text-left font-bold text-slate-500 uppercase tracking-wider px-3 py-2 text-[10.5px]">Required</th>
                  <th className="text-left font-bold text-slate-500 uppercase tracking-wider px-3 py-2 text-[10.5px]">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ep.params.map((p) => (
                  <tr key={p.name}>
                    <td className="px-3 py-2 font-mono text-[11.5px] whitespace-nowrap">{p.name}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{p.location}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.required === true ? '✅' : p.required === false ? '—' : p.required}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-350">{p.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <p className="text-[11px] font-bold text-slate-450 uppercase tracking-widest mb-2">Example Request</p>
        <CodeBlock onCopy={() => onCopy(ep.example.request)}>{ep.example.request}</CodeBlock>
      </div>

      <div>
        <p className="text-[11px] font-bold text-slate-450 uppercase tracking-widest mb-2">Example Response</p>
        <CodeBlock onCopy={() => onCopy(ep.example.response)}>{ep.example.response}</CodeBlock>
      </div>

      {ep.errors.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-450 uppercase tracking-widest mb-2">Errors</p>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-[12.5px]">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ep.errors.map((e) => (
                  <tr key={e.status}>
                    <td className="px-3 py-2 font-mono text-[11.5px] font-semibold text-red-500 whitespace-nowrap w-16">{e.status}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-350">{e.cause}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiDocsModal({ open, onClose }) {
  const [activeId, setActiveId] = useState('overview');

  if (!open) return null;

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  const activeEndpoint = ALL_ENDPOINTS.find((e) => e.id === activeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
              <BookOpen size={18} className="text-indigo-500" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">API Integration Documentation</h3>
              <p className="text-[12px] text-slate-450">Developer guide and endpoint reference</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-450">
            <X size={16} />
          </button>
        </div>

        {/* Body: left nav + right content */}
        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-3 space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-3 py-1.5">Getting Started</p>
              {GETTING_STARTED.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveId(item.id)}
                    className={cn(
                      'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all text-left mb-0.5',
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-l-2 border-indigo-500'
                        : 'text-slate-600 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    )}
                  >
                    <item.icon size={15} className={cn('flex-shrink-0', isActive ? 'text-indigo-500' : 'text-slate-400')} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {ENDPOINT_GROUPS.map((group) => (
              <div key={group.domain}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-3 py-1.5 flex items-center gap-1.5">
                  Endpoints — {group.domain}
                  {group.optionalAuth && (
                    <span className="badge badge-neutral text-[9px] font-bold px-1.5 py-0.5 normal-case tracking-normal">key optional</span>
                  )}
                </p>
                {group.endpoints.map((ep) => {
                  const isActive = activeId === ep.id;
                  return (
                    <button
                      key={ep.id}
                      onClick={() => setActiveId(ep.id)}
                      className={cn(
                        'flex flex-col items-start gap-1 w-full px-3 py-2 rounded-xl text-left mb-0.5',
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                      )}
                    >
                      <span className={cn('text-[12.5px] font-semibold', isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300')}>
                        {ep.name}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MethodBadge method={ep.method} />
                        <code className="text-[10.5px] text-slate-450">{ep.path}</code>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeId === 'overview' && <OverviewContent />}
            {activeId === 'auth' && <AuthContent />}
            {activeId === 'codes' && <CodesContent />}
            {activeEndpoint && <EndpointContent ep={activeEndpoint} onCopy={copy} />}
          </div>
        </div>
      </div>
    </div>
  );
}
