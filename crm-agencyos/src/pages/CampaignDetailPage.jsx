import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Play, Pause, Trash2, Upload, Send, MailOpen, MousePointerClick,
  Users, XCircle, AlertTriangle, Ban, MessageSquareOff, Settings2, ListChecks,
  FileSpreadsheet, UserPlus, ShieldCheck, ShieldAlert, ShieldQuestion, RefreshCw, Loader2,
  BarChart3, MailX, ExternalLink, FileText, Code2, Info, Stethoscope, CheckCircle2, Wrench,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { Page, Button, Tabs, Input, Toggle, Select, StatCard, EmptyState, ConfirmDialog, Modal } from '../components/ui';
import EmailAccountsModal from '../components/campaigns/EmailAccountsModal';
import EmailTemplatesModal from '../components/campaigns/EmailTemplatesModal';
import RichTextEditor from '../components/campaigns/RichTextEditor';
import { cn } from '../utils/helpers';
import { buildDailySeries, buildActivityFeed, buildStepSummary, getBounces } from '../utils/campaignAnalytics';
import { checkSpamContent } from '../utils/spamCheck';

// Categorical slots 1/2/3/4 from the app's validated data-viz palette —
// fixed order, not cycled. Light/dark pair per slot.
const SERIES_COLOR = {
  sent:        { light: '#2a78d6', dark: '#3987e5' }, // slot 1 — blue
  totalOpens:  { light: '#eb6834', dark: '#d95926' }, // slot 2 — orange
  uniqueOpens: { light: '#1baf7a', dark: '#199e70' }, // slot 3 — aqua
  replied:     { light: '#eda100', dark: '#c98500' }, // slot 4 — yellow
  totalClicks: { light: '#e87ba4', dark: '#d55181' }, // slot 5 — magenta (only shown if link tracking is on)
};

const LEAD_STATUS_BADGE = {
  pending:      { label: 'Pending',      tw: 'badge-neutral' },
  scheduled:    { label: 'Scheduled',    tw: 'badge-info' },
  sending:      { label: 'Sending',      tw: 'badge-info' },
  sent:         { label: 'Sent',         tw: 'badge-success' },
  failed:       { label: 'Failed',       tw: 'badge-danger' },
  bounced:      { label: 'Bounced',      tw: 'badge-danger' },
  replied:      { label: 'Replied',      tw: 'badge-purple' },
  unsubscribed: { label: 'Unsubscribed', tw: 'badge-warning' },
};

const TABS = [
  { value: 'analytics', label: 'Analytics' },
  { value: 'leads',    label: 'Leads' },
  { value: 'compose',  label: 'Compose' },
  { value: 'settings', label: 'Settings' },
];

// Hover tooltip on the Opens count — newest first, last 50 kept server-side
function formatOpenHistory(lead) {
  if (!lead.openCount) return 'Not opened yet';
  const events = lead.opens?.length ? [...lead.opens].reverse() : null;
  if (!events) return `${lead.openCount} open${lead.openCount === 1 ? '' : 's'}`;
  const lines = events.map((o) => new Date(o.at).toLocaleString());
  const suffix = lead.openCount > events.length ? `\n… and ${lead.openCount - events.length} earlier` : '';
  return `${lead.openCount} open${lead.openCount === 1 ? '' : 's'}:\n${lines.join('\n')}${suffix}`;
}

const VERIFICATION_BADGE = {
  valid:      { label: 'Valid',      icon: ShieldCheck,    tw: 'text-emerald-600 dark:text-emerald-400' },
  invalid:    { label: 'Invalid',    icon: ShieldAlert,    tw: 'text-red-500' },
  risky:      { label: 'Risky',      icon: ShieldAlert,    tw: 'text-amber-500' },
  unverified: { label: 'Unverified', icon: ShieldQuestion, tw: 'text-slate-400' },
};

// Quick hover hint next to the status badge — a cheap, client-side-only
// guess (no API call) to explain the current state at a glance. The
// "Diagnose" button does the real, thorough check against the backend.
function statusHint(campaign) {
  if (campaign.status === 'draft') return 'Draft — not sending. Add a subject/body, leads, and a sending account, then hit Start.';
  if (campaign.status === 'paused') return 'Paused — sending is stopped until you hit Start again.';
  if (campaign.status === 'completed') return 'Completed — every lead has been sent to, failed, or bounced.';
  if (campaign.status === 'active') {
    if (campaign.nextEligibleAt && new Date(campaign.nextEligibleAt) > new Date()) {
      const secs = Math.max(0, Math.round((new Date(campaign.nextEligibleAt) - Date.now()) / 1000));
      return `Active — waiting ~${secs}s before the next send (sending-pattern gap). Click Diagnose for the full picture.`;
    }
    return 'Active — should be sending within its configured pace. Click Diagnose if nothing seems to be happening.';
  }
  return '';
}

const FINDING_STYLE = {
  ok:      { icon: CheckCircle2,  tw: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900' },
  info:    { icon: Info,          tw: 'text-slate-500 dark:text-slate-400',     bg: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700' },
  warning: { icon: AlertTriangle, tw: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/50' },
  error:   { icon: XCircle,       tw: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50' },
};

function DiagnoseModal({ open, onClose, campaignId, onDiagnose, onResolveStuck }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [fixing, setFixing] = useState(false);

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      const data = await onDiagnose(campaignId);
      setResult(data);
    } catch {
      // toast already shown
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) runDiagnosis(); else setResult(null); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFixStuck = async () => {
    setFixing(true);
    try {
      await onResolveStuck(campaignId);
      await runDiagnosis(); // re-check immediately so the fix is reflected
    } finally {
      setFixing(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Campaign Diagnosis" size="lg">
      <div className="px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : result ? (
          <div className="space-y-2.5">
            {result.findings.map((f, i) => {
              const style = FINDING_STYLE[f.level] || FINDING_STYLE.info;
              return (
                <div key={i} className={cn('flex items-start gap-2.5 p-3 rounded-xl border', style.bg)}>
                  <style.icon size={15} className={cn('flex-shrink-0 mt-0.5', style.tw)} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[13px]', style.tw)}>{f.message}</p>
                    {Array.isArray(f.detail) && f.detail.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                        {f.detail.map((d, j) => (
                          <li key={j} className="truncate">
                            {d.email}{d.status && ` — ${d.status}`}{d.error && `: ${d.error}`}{d.since && ` (since ${new Date(d.since).toLocaleTimeString()})`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-slate-400">Checked {new Date(result.checkedAt).toLocaleTimeString()}</p>
              <div className="flex gap-2">
                {result.hasStuckLeads && (
                  <Button variant="danger" size="sm" onClick={handleFixStuck} loading={fixing}>
                    <Wrench size={13} /> Fix stuck leads
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={runDiagnosis}>
                  <RefreshCw size={13} /> Re-check
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    campaigns, campaignLeads, emailAccounts, darkMode,
    loadCampaign, loadCampaignLeads, loadEmailAccounts,
    updateCampaign, deleteCampaign, startCampaign, pauseCampaign,
    importCampaignLeadsCsv, importCampaignLeadsSheet, addCampaignLeadManual,
    deleteCampaignLead, markCampaignLeadReplied, verifyCampaignLead, verifyAllCampaignLeads,
    diagnoseCampaign, resolveStuckCampaignLeads,
  } = useAppStore(useShallow((s) => ({
    campaigns: s.campaigns,
    campaignLeads: s.campaignLeads,
    emailAccounts: s.emailAccounts,
    darkMode: s.darkMode,
    loadCampaign: s.loadCampaign,
    loadCampaignLeads: s.loadCampaignLeads,
    loadEmailAccounts: s.loadEmailAccounts,
    updateCampaign: s.updateCampaign,
    deleteCampaign: s.deleteCampaign,
    startCampaign: s.startCampaign,
    pauseCampaign: s.pauseCampaign,
    importCampaignLeadsCsv: s.importCampaignLeadsCsv,
    importCampaignLeadsSheet: s.importCampaignLeadsSheet,
    addCampaignLeadManual: s.addCampaignLeadManual,
    deleteCampaignLead: s.deleteCampaignLead,
    markCampaignLeadReplied: s.markCampaignLeadReplied,
    verifyCampaignLead: s.verifyCampaignLead,
    verifyAllCampaignLeads: s.verifyAllCampaignLeads,
    diagnoseCampaign: s.diagnoseCampaign,
    resolveStuckCampaignLeads: s.resolveStuckCampaignLeads,
  })));

  const campaign = campaigns.find((c) => c._id === id);
  const [tab, setTab] = useState('analytics');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [accountsModalOpen, setAccountsModalOpen] = useState(false);
  const [diagnoseOpen, setDiagnoseOpen] = useState(false);
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadCampaign(id);
    loadCampaignLeads(id);
    loadEmailAccounts();
  }, [id, loadCampaign, loadCampaignLeads, loadEmailAccounts]);

  if (!campaign) {
    return (
      <Page>
        <Link to="/campaigns" className="flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft size={14} /> Back to Campaigns
        </Link>
        <div className="card p-10 text-center text-slate-400 text-[13px]">Loading campaign…</div>
      </Page>
    );
  }

  const stats = campaign.stats || {};

  const handleToggleStatus = async () => {
    if (campaign.status === 'active') pauseCampaign(campaign._id);
    else await startCampaign(campaign._id);
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      await importCampaignLeadsCsv(campaign._id, file);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Page>
      <Link to="/campaigns" className="flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4">
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="page-title truncate">{campaign.name}</h1>
            <span className={cn('badge', {
              draft: 'badge-neutral', active: 'badge-success', paused: 'badge-warning', completed: 'badge-info',
            }[campaign.status])}>
              {campaign.status}
            </span>
            <span title={statusHint(campaign)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help">
              <Info size={14} />
            </span>
          </div>
          <p className="page-sub">Created {new Date(campaign.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => setDiagnoseOpen(true)}>
            <Stethoscope size={14} /> Diagnose
          </Button>
          {campaign.status !== 'completed' && (
            <Button variant={campaign.status === 'active' ? 'outline' : 'primary'} onClick={handleToggleStatus}>
              {campaign.status === 'active' ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Start</>}
            </Button>
          )}
          <Button variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <DiagnoseModal
        open={diagnoseOpen}
        onClose={() => setDiagnoseOpen(false)}
        campaignId={campaign._id}
        onDiagnose={diagnoseCampaign}
        onResolveStuck={resolveStuckCampaignLeads}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon={Users} label="Total Leads" value={stats.total || 0} color="#6366f1" bg="#eef2ff" />
        <StatCard icon={Send} label="Sent" value={stats.sent || 0} color="#0ea5e9" bg="#f0f9ff" />
        <StatCard icon={MailOpen} label="Opened" value={stats.opened || 0} color="#10b981" bg="#ecfdf5" />
        <StatCard icon={MousePointerClick} label="Clicked" value={stats.clicked || 0} color="#7c3aed" bg="#f5f3ff" />
        <StatCard icon={MessageSquareOff} label="Replied" value={stats.replied || 0} color="#d97706" bg="#fffbeb" />
        <StatCard icon={Ban} label="Unsubscribed" value={stats.unsubscribed || 0} color="#dc2626" bg="#fef2f2" />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-5" />

      {tab === 'analytics' && (
        <AnalyticsTab campaign={campaign} leads={campaignLeads} darkMode={darkMode} />
      )}

      {tab === 'leads' && (
        <LeadsTab
          campaign={campaign}
          leads={campaignLeads}
          importing={importing}
          fileInputRef={fileInputRef}
          onFileSelected={handleFileSelected}
          onImportSheet={(url) => importCampaignLeadsSheet(campaign._id, url)}
          onAddManual={(lead) => addCampaignLeadManual(campaign._id, lead)}
          onDeleteLead={(leadId) => deleteCampaignLead(campaign._id, leadId)}
          onMarkReplied={(leadId) => markCampaignLeadReplied(campaign._id, leadId)}
          onVerifyLead={(leadId) => verifyCampaignLead(campaign._id, leadId)}
          onVerifyAll={() => verifyAllCampaignLeads(campaign._id)}
        />
      )}

      {tab === 'compose' && (
        <ComposeTab campaign={campaign} onSave={(body) => updateCampaign(campaign._id, body)} />
      )}

      {tab === 'settings' && (
        <SettingsTab
          campaign={campaign}
          emailAccounts={emailAccounts}
          onSave={(body) => updateCampaign(campaign._id, { settings: body })}
          onManageAccounts={() => setAccountsModalOpen(true)}
        />
      )}

      <EmailAccountsModal open={accountsModalOpen} onClose={() => setAccountsModalOpen(false)} />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteCampaign(campaign._id); navigate('/campaigns'); }}
        title="Delete campaign?"
        message={`This will permanently remove "${campaign.name}" and stop any in-progress sending.`}
        confirmLabel="Delete"
      />
    </Page>
  );
}

// ── Analytics Tab ──────────────────────────────────────────────────────
const RANGE_OPTIONS = [
  { value: '7',   label: 'Last 7 days' },
  { value: '14',  label: 'Last 14 days' },
  { value: '30',  label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

const ANALYTICS_SUBTABS = [
  { value: 'step',     label: 'Step Analytics' },
  { value: 'activity', label: 'Activity' },
  { value: 'bounces',  label: 'Bounces' },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-modal px-3 py-2 text-[12px]">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsTab({ campaign, leads, darkMode }) {
  const [range, setRange] = useState('7');
  const [subTab, setSubTab] = useState('step');

  const days = range === 'all' ? 'all' : Number(range);
  const series = buildDailySeries(leads, days);
  const stepSummary = buildStepSummary(leads);
  const activity = buildActivityFeed(leads);
  const bounces = getBounces(leads);
  const linkTrackingOn = !!campaign.settings?.linkTracking;

  const total = leads.length;
  const done = leads.filter((l) => l.status !== 'pending').length;
  const progressPct = total ? Math.round((done / total) * 100) : 0;

  const color = (key) => SERIES_COLOR[key][darkMode ? 'dark' : 'light'];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] text-slate-500 dark:text-slate-400">Status:</span>
          <span className={cn('badge', {
            draft: 'badge-neutral', active: 'badge-success', paused: 'badge-warning', completed: 'badge-info',
          }[campaign.status])}>
            {campaign.status}
          </span>
          <div className="flex items-center gap-2 w-32">
            <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{progressPct}%</span>
          </div>
        </div>
        <div className="w-40">
          <Select value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Send} label="Sequence Started" value={stepSummary.sent} color="#6366f1" bg="#eef2ff" />
        <StatCard icon={MailOpen} label="Open Rate" value={`${stepSummary.openRate.toFixed(1)}%`} color="#1baf7a" bg="#ecfdf5" />
        <StatCard
          icon={MousePointerClick}
          label="Click Rate"
          value={linkTrackingOn ? `${stepSummary.clickRate.toFixed(1)}%` : 'Disabled'}
          color={linkTrackingOn ? '#e87ba4' : '#94a3b8'}
          bg={linkTrackingOn ? '#fdf2f8' : '#f1f5f9'}
        />
        <StatCard icon={MessageSquareOff} label="Replied" value={stepSummary.replied} color="#eda100" bg="#fffbeb" />
        <StatCard icon={MailX} label="Bounced" value={bounces.length} color="#dc2626" bg="#fef2f2" />
      </div>

      <div className="card p-5">
        {series.length === 0 ? (
          <EmptyState icon={BarChart3} title="No activity yet" description="Once this campaign starts sending, activity will show up here." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} width={28} />
              <RTooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              <Area type="monotone" dataKey="sent" name="Sent" stroke={color('sent')} fill={color('sent')} fillOpacity={0.18} strokeWidth={2} />
              <Area type="monotone" dataKey="totalOpens" name="Total opens" stroke={color('totalOpens')} fill={color('totalOpens')} fillOpacity={0.12} strokeWidth={2} />
              <Area type="monotone" dataKey="uniqueOpens" name="Unique opens" stroke={color('uniqueOpens')} fill={color('uniqueOpens')} fillOpacity={0.12} strokeWidth={2} />
              <Area type="monotone" dataKey="replied" name="Replies" stroke={color('replied')} fill={color('replied')} fillOpacity={0.12} strokeWidth={2} />
              {linkTrackingOn && (
                <Area type="monotone" dataKey="totalClicks" name="Total clicks" stroke={color('totalClicks')} fill={color('totalClicks')} fillOpacity={0.12} strokeWidth={2} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-2 pt-2">
          <Tabs tabs={ANALYTICS_SUBTABS} active={subTab} onChange={setSubTab} />
        </div>

        {subTab === 'step' && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Step</th>
                  <th className="px-4 py-2.5 font-medium">Sent</th>
                  <th className="px-4 py-2.5 font-medium">Opened</th>
                  <th className="px-4 py-2.5 font-medium">Replied</th>
                  <th className="px-4 py-2.5 font-medium">Clicked</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Step 1</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{stepSummary.sent}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{stepSummary.opened} | {stepSummary.openRate.toFixed(0)}%</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{stepSummary.replied} | {stepSummary.replyRate.toFixed(0)}%</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {linkTrackingOn ? `${stepSummary.clicked} | ${stepSummary.clickRate.toFixed(0)}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="px-4 py-3 text-[11.5px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
              Campaigns here send a single email (no multi-step sequences yet), so there's one step to report on.
            </p>
          </div>
        )}

        {subTab === 'activity' && (
          activity.length === 0 ? (
            <EmptyState icon={BarChart3} title="No activity yet" />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
              {activity.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ActivityIcon type={e.type} />
                    <span className="text-slate-700 dark:text-slate-300 truncate">{e.email}</span>
                    {e.type === 'clicked' && e.url && (
                      <a href={e.url} target="_blank" rel="noreferrer" className="text-primary-500 hover:underline flex items-center gap-0.5 flex-shrink-0">
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  <span className="text-[11.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{timeAgo(e.at)}</span>
                </div>
              ))}
            </div>
          )
        )}

        {subTab === 'bounces' && (
          bounces.length === 0 ? (
            <EmptyState icon={MailX} title="No bounces" description="Hard-bounced addresses (permanent SMTP rejections) will show up here." />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {bounces.map((l) => (
                <div key={l._id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                  <span className="text-slate-700 dark:text-slate-300">{l.email}</span>
                  <span className="text-[11.5px] text-red-500 truncate max-w-xs" title={l.error}>{l.error || 'Bounced'}</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

const ACTIVITY_ICON = {
  sent:         { icon: Send,             tw: 'text-primary-500' },
  opened:       { icon: MailOpen,         tw: 'text-amber-500' },
  clicked:      { icon: MousePointerClick, tw: 'text-pink-500' },
  replied:      { icon: MessageSquareOff, tw: 'text-yellow-600' },
  bounced:      { icon: MailX,            tw: 'text-red-500' },
  unsubscribed: { icon: Ban,              tw: 'text-slate-400' },
};

function ActivityIcon({ type }) {
  const cfg = ACTIVITY_ICON[type] || ACTIVITY_ICON.sent;
  return <cfg.icon size={14} className={cn('flex-shrink-0', cfg.tw)} />;
}

function timeAgo(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

// ── Leads Tab ──────────────────────────────────────────────────────────
const ADD_MODES = [
  { value: 'csv',    label: 'Upload CSV',        icon: Upload },
  { value: 'manual', label: 'Add Manually',      icon: UserPlus },
  { value: 'sheet',  label: 'Google Sheet',      icon: FileSpreadsheet },
];

function LeadsTab({ campaign, leads, importing, fileInputRef, onFileSelected, onImportSheet, onAddManual, onDeleteLead, onMarkReplied, onVerifyLead, onVerifyAll }) {
  const [mode, setMode] = useState('csv');
  const [manualForm, setManualForm] = useState({ email: '', firstName: '', lastName: '' });
  const [addingManual, setAddingManual] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [importingSheet, setImportingSheet] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [verifyingAll, setVerifyingAll] = useState(false);

  const unverifiedCount = leads.filter((l) => l.verificationStatus === 'unverified').length;

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.email.trim()) return;
    setAddingManual(true);
    try {
      await onAddManual(manualForm);
      setManualForm({ email: '', firstName: '', lastName: '' });
    } finally {
      setAddingManual(false);
    }
  };

  const handleSheetSubmit = async (e) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;
    setImportingSheet(true);
    try {
      await onImportSheet(sheetUrl.trim());
      setSheetUrl('');
    } finally {
      setImportingSheet(false);
    }
  };

  const handleVerify = async (leadId) => {
    setVerifyingId(leadId);
    await onVerifyLead(leadId);
    setVerifyingId(null);
  };

  const handleVerifyAll = async () => {
    setVerifyingAll(true);
    await onVerifyAll();
    setVerifyingAll(false);
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex gap-1.5 mb-4">
          {ADD_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors',
                mode === m.value
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <m.icon size={13} /> {m.label}
            </button>
          ))}
        </div>

        {mode === 'csv' && (
          <label
            htmlFor="campaign-csv-upload"
            className={cn(
              'flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
              importing ? 'opacity-60 pointer-events-none' : 'hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10',
              'border-slate-300 dark:border-slate-600'
            )}
          >
            <Upload size={22} className="text-slate-400" />
            <p className="text-[13.5px] font-medium text-slate-700 dark:text-slate-300">
              {importing ? 'Importing…' : 'Click to upload a CSV file'}
            </p>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              Columns: <code className="font-mono">email, first_name, last_name</code>
            </p>
            <input
              id="campaign-csv-upload"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFileSelected}
              disabled={importing}
            />
          </label>
        )}

        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row items-end gap-3 max-w-2xl">
            <div className="flex-[2] w-full">
              <Input
                label="Email" type="email" required placeholder="lead@company.com"
                value={manualForm.email} onChange={(e) => setManualForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="flex-1 w-full">
              <Input
                label="First name" placeholder="Jane"
                value={manualForm.firstName} onChange={(e) => setManualForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="flex-1 w-full">
              <Input
                label="Last name" placeholder="Doe"
                value={manualForm.lastName} onChange={(e) => setManualForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
            <Button type="submit" variant="primary" loading={addingManual} disabled={!manualForm.email.trim()}>
              <UserPlus size={14} /> Add Lead
            </Button>
          </form>
        )}

        {mode === 'sheet' && (
          <form onSubmit={handleSheetSubmit} className="max-w-2xl space-y-2">
            <div className="flex items-end gap-3">
              <div className="flex-1 w-full">
                <Input
                  label="Google Sheet link"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)}
                />
              </div>
              <Button type="submit" variant="primary" loading={importingSheet} disabled={!sheetUrl.trim()}>
                <FileSpreadsheet size={14} /> Import
              </Button>
            </div>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              Sheet must be shared as <strong>"Anyone with the link can view"</strong> (Share → General access), with column headers
              <code className="font-mono mx-1">email, first_name, last_name</code> in the first sheet tab.
            </p>
          </form>
        )}
      </div>

      <div className="card overflow-hidden">
        {leads.length === 0 ? (
          <EmptyState icon={ListChecks} title="No leads imported yet" description="Add leads above to get this campaign started." />
        ) : (
          <>
            {unverifiedCount > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/50">
                <span className="text-[12px] text-amber-700 dark:text-amber-400">{unverifiedCount} lead{unverifiedCount === 1 ? '' : 's'} not yet verified</span>
                <Button variant="ghost" size="sm" onClick={handleVerifyAll} loading={verifyingAll}>
                  <RefreshCw size={12} /> Verify all
                </Button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">First Name</th>
                    <th className="px-4 py-2.5 font-medium">Last Name</th>
                    <th className="px-4 py-2.5 font-medium">Verification</th>
                    <th className="px-4 py-2.5 font-medium">Provider</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-center">Opens</th>
                    <th className="px-4 py-2.5 font-medium">Last Opened</th>
                    <th className="px-4 py-2.5 font-medium text-center">Clicks</th>
                    <th className="px-4 py-2.5 font-medium">Sent</th>
                    <th className="px-4 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => {
                    const badge = LEAD_STATUS_BADGE[l.status] || LEAD_STATUS_BADGE.pending;
                    const vBadge = VERIFICATION_BADGE[l.verificationStatus] || VERIFICATION_BADGE.unverified;
                    return (
                      <tr key={l._id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{l.email}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{l.firstName || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{l.lastName || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span title={l.verificationDetail || vBadge.label} className={cn('inline-flex items-center gap-1 font-medium', vBadge.tw)}>
                            <vBadge.icon size={13} /> {vBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{l.provider || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('badge', badge.tw)}>{badge.label}</span>
                          {l.error && <span title={l.error}><AlertTriangle size={12} className="inline ml-1.5 text-red-400" /></span>}
                        </td>
                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-400">
                          <span title={formatOpenHistory(l)} className={l.openCount ? 'underline decoration-dotted cursor-help' : ''}>
                            {l.openCount || 0}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {l.openedAt ? new Date(l.openedAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-400">{l.clickCount || 0}</td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {l.sentAt ? new Date(l.sentAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleVerify(l._id)}
                              title="Re-verify email"
                              disabled={verifyingId === l._id}
                              className="btn-icon text-slate-400 hover:text-primary-500"
                            >
                              {verifyingId === l._id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                            </button>
                            {l.status === 'sent' && (
                              <button
                                onClick={() => onMarkReplied(l._id)}
                                title="Mark as replied (stops further sends to this lead)"
                                className="btn-icon text-slate-400 hover:text-purple-500"
                              >
                                <MessageSquareOff size={13} />
                              </button>
                            )}
                            <button onClick={() => onDeleteLead(l._id)} className="btn-icon text-slate-400 hover:text-red-500">
                              <XCircle size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Compose Tab ────────────────────────────────────────────────────────
function ComposeTab({ campaign, onSave }) {
  const uploadCampaignImage = useAppStore((s) => s.uploadCampaignImage);
  const [subject, setSubject] = useState(campaign.subject || '');
  const [body, setBody] = useState(campaign.bodyHtml || '');
  const [saving, setSaving] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => { setSubject(campaign.subject || ''); setBody(campaign.bodyHtml || ''); }, [campaign._id]);

  const spamCheck = useMemo(() => checkSpamContent(subject, body), [subject, body]);

  const insertTag = (tag) => editorRef.current?.insertText(tag);

  const handleApplyTemplate = (t) => {
    setSubject(t.subject || '');
    setBody(t.bodyHtml || '');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ subject, bodyHtml: body });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-6 space-y-4 max-w-5xl">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input label="Subject line" placeholder="e.g. Quick question about {{first_name}}'s finances" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
          <FileText size={14} /> Templates
        </Button>
      </div>

      <div>
        <label className="form-label">Email body</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {['{{first_name}}', '{{last_name}}', '{{email}}'].map((tag) => (
            <button key={tag} type="button" onClick={() => insertTag(tag)} className="text-[11px] font-mono px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              {tag}
            </button>
          ))}
        </div>
        <RichTextEditor
          ref={editorRef}
          value={body}
          onChange={setBody}
          onUploadImage={uploadCampaignImage}
          placeholder="Hi {{first_name}}, write your message here…"
        />
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1.5">
          Merge tags are replaced per-recipient at send time. Unsubscribe footer is added automatically.
          Use the <Code2Inline /> button in the toolbar to edit raw HTML directly.
        </p>
      </div>

      {spamCheck.warnings.length > 0 && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50">
          <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12.5px] font-semibold text-amber-700 dark:text-amber-400">Possible spam-filter triggers</p>
            <ul className="text-[12px] text-amber-700 dark:text-amber-400 mt-1 space-y-0.5 list-disc pl-4">
              {spamCheck.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80 mt-1.5">
              This is a heuristic, not a guarantee — real spam filters weigh many signals we can't see. Not a hard block on sending.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} loading={saving}>Save Email</Button>
      </div>

      <EmailTemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelect={handleApplyTemplate}
        currentSubject={subject}
        currentBody={body}
      />
    </div>
  );
}

function Code2Inline() {
  return <Code2 size={11} className="inline -mt-0.5 mx-0.5" />;
}

// ── Settings Tab ───────────────────────────────────────────────────────
function SettingsTab({ campaign, emailAccounts, onSave, onManageAccounts }) {
  const s = campaign.settings || {};
  const [accounts, setAccounts] = useState((s.accounts || []).map((a) => a._id || a));
  const [stopOnReply, setStopOnReply] = useState(s.stopOnReply ?? true);
  const [openTracking, setOpenTracking] = useState(s.openTracking ?? true);
  const [linkTracking, setLinkTracking] = useState(s.linkTracking ?? false);
  const [textOnly, setTextOnly] = useState(s.textOnly ?? false);
  const [firstEmailTextOnly, setFirstEmailTextOnly] = useState(s.firstEmailTextOnly ?? false);
  const [dailyLimit, setDailyLimit] = useState(s.dailyLimit ?? 30);
  const [minGapMinutes, setMinGapMinutes] = useState(s.minGapMinutes ?? 9);
  const [randomGapMinutes, setRandomGapMinutes] = useState(s.randomGapMinutes ?? 5);
  const [maxNewLeadsPerDay, setMaxNewLeadsPerDay] = useState(s.maxNewLeadsPerDay ?? '');
  const [sendingHoursEnabled, setSendingHoursEnabled] = useState(s.sendingHoursEnabled ?? false);
  const [sendingHourStart, setSendingHourStart] = useState(s.sendingHourStart ?? 9);
  const [sendingHourEnd, setSendingHourEnd] = useState(s.sendingHourEnd ?? 18);
  const [sendingDays, setSendingDays] = useState(s.sendingDays ?? [1, 2, 3, 4, 5]);
  const [timezone, setTimezone] = useState(s.timezone ?? 'Asia/Kolkata');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAccounts((s.accounts || []).map((a) => a._id || a));
    setStopOnReply(s.stopOnReply ?? true);
    setOpenTracking(s.openTracking ?? true);
    setLinkTracking(s.linkTracking ?? false);
    setTextOnly(s.textOnly ?? false);
    setFirstEmailTextOnly(s.firstEmailTextOnly ?? false);
    setDailyLimit(s.dailyLimit ?? 30);
    setMinGapMinutes(s.minGapMinutes ?? 9);
    setRandomGapMinutes(s.randomGapMinutes ?? 5);
    setMaxNewLeadsPerDay(s.maxNewLeadsPerDay ?? '');
    setSendingHoursEnabled(s.sendingHoursEnabled ?? false);
    setSendingHourStart(s.sendingHourStart ?? 9);
    setSendingHourEnd(s.sendingHourEnd ?? 18);
    setSendingDays(s.sendingDays ?? [1, 2, 3, 4, 5]);
    setTimezone(s.timezone ?? 'Asia/Kolkata');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign._id]);

  const toggleDay = (d) => {
    setSendingDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  };

  const toggleAccount = (id) => {
    setAccounts((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    // A blank/zero Daily Limit isn't "unlimited" here — dispatchOne() treats
    // 0 as an already-reached cap and stops sending entirely with no
    // obvious error. Guard against clearing the field by accident.
    if (!(Number(dailyLimit) > 0)) {
      toast.error('Daily Limit must be at least 1 — leave it blank and the campaign will never send.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        accounts, stopOnReply, openTracking, linkTracking, textOnly, firstEmailTextOnly,
        dailyLimit: Number(dailyLimit),
        minGapMinutes: Number(minGapMinutes) || 0,
        randomGapMinutes: Number(randomGapMinutes) || 0,
        maxNewLeadsPerDay: maxNewLeadsPerDay === '' ? null : Number(maxNewLeadsPerDay),
        sendingHoursEnabled, sendingHourStart: Number(sendingHourStart), sendingHourEnd: Number(sendingHourEnd),
        sendingDays, timezone,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">Accounts to use</p>
          <Button variant="ghost" size="sm" onClick={onManageAccounts}><Settings2 size={13} /> Manage accounts</Button>
        </div>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-3">Select one or more accounts to send emails from</p>
        {emailAccounts.length === 0 ? (
          <p className="text-[12.5px] text-amber-600 dark:text-amber-400">No sending accounts configured — add one to enable sending.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {emailAccounts.map((a) => (
              <button
                key={a._id}
                type="button"
                onClick={() => toggleAccount(a._id)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg border text-[12.5px] font-medium transition-colors',
                  accounts.includes(a._id)
                    ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/20 dark:border-primary-700 dark:text-primary-300'
                    : 'border-slate-300 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                {a.email}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5 divide-y divide-slate-100 dark:divide-slate-800">
        <Toggle checked={stopOnReply} onChange={setStopOnReply} label="Stop sending emails on reply" description="Stop sending emails to a lead if a response has been received (manual — see note below)" />
        <Toggle checked={openTracking} onChange={setOpenTracking} label="Open Tracking" description="Track email opens via an invisible tracking pixel" />
        <div className="flex items-center gap-2 py-2 pl-4">
          <input type="checkbox" checked={linkTracking} onChange={(e) => setLinkTracking(e.target.checked)} className="rounded border-slate-300" />
          <span className="text-[12.5px] text-slate-600 dark:text-slate-400">Link tracking (rewrites links to track clicks)</span>
        </div>
      </div>

      <div className="card p-5">
        <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200 mb-3">Delivery Optimization</p>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={textOnly} onChange={(e) => setTextOnly(e.target.checked)} className="rounded border-slate-300" />
            <span className="text-[12.5px] text-slate-600 dark:text-slate-400">Send emails as text-only (no HTML)</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={firstEmailTextOnly} onChange={(e) => setFirstEmailTextOnly(e.target.checked)} className="rounded border-slate-300" />
            <span className="text-[12.5px] text-slate-600 dark:text-slate-400">Send first email as text-only</span>
          </label>
        </div>
      </div>

      <div className="card p-5">
        <Input
          label="Daily Limit"
          type="number" min="1"
          value={dailyLimit}
          onChange={(e) => setDailyLimit(e.target.value)}
        />
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">Max number of emails to send per day for this campaign</p>
      </div>

      <div className="card p-5 space-y-4">
        <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">Sending Pattern</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Minimum time between emails (min)" type="number" min="0" value={minGapMinutes} onChange={(e) => setMinGapMinutes(e.target.value)} />
          <Input label="Random additional time (min)" type="number" min="0" value={randomGapMinutes} onChange={(e) => setRandomGapMinutes(e.target.value)} />
        </div>
        <Input
          label="Max new leads per day"
          type="number" min="0"
          placeholder="No limit"
          value={maxNewLeadsPerDay}
          onChange={(e) => setMaxNewLeadsPerDay(e.target.value)}
        />
      </div>

      <div className="card p-5 space-y-4">
        <Toggle
          checked={sendingHoursEnabled}
          onChange={setSendingHoursEnabled}
          label="Restrict sending hours"
          description="Only send during specific hours/days — avoids the robotic look of off-hours sends"
        />
        {sendingHoursEnabled && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-3 gap-3">
              <Select label="Start hour" value={sendingHourStart} onChange={(e) => setSendingHourStart(e.target.value)}>
                {[...Array(24)].map((_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </Select>
              <Select label="End hour" value={sendingHourEnd} onChange={(e) => setSendingHourEnd(e.target.value)}>
                {[...Array(24)].map((_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </Select>
              <Select label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New York (ET)</option>
                <option value="America/Los_Angeles">America/Los Angeles (PT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
              </Select>
            </div>
            <div>
              <label className="form-label">Days</label>
              <div className="flex gap-1.5">
                {[{ v: 1, l: 'Mon' }, { v: 2, l: 'Tue' }, { v: 3, l: 'Wed' }, { v: 4, l: 'Thu' }, { v: 5, l: 'Fri' }, { v: 6, l: 'Sat' }, { v: 0, l: 'Sun' }].map((d) => (
                  <button
                    key={d.v} type="button" onClick={() => toggleDay(d.v)}
                    className={cn(
                      'w-10 h-8 rounded-lg border text-[12px] font-medium transition-colors',
                      sendingDays.includes(d.v)
                        ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/20 dark:border-primary-700 dark:text-primary-300'
                        : 'border-slate-300 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    {d.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} loading={saving}>Save Settings</Button>
      </div>
    </div>
  );
}
