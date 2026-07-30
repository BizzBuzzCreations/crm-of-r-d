import { useMemo, useState } from 'react';
import {
  Flame, MessageSquareText, Inbox, UserX, ArrowRightCircle, Eye, Mail, Clock, Megaphone, PhoneCall,
} from 'lucide-react';
import { Avatar, Badge, Button } from '../components/ui';
import { cn, getId } from '../utils/helpers';

// ── Stat tiles — scoped ONLY to campaign-sourced leads, independent of the
// main B2B Leads Pipeline's own stats (Total/Hot/Won/Lost/Pipeline/Conversion) ──
function EmailLeadsSummary({ leads }) {
  const stats = useMemo(() => {
    const total = leads.length;
    const hot = leads.filter((l) => l.tags?.includes('Hot')).length;
    const replied = leads.filter((l) => l.tags?.includes('Replied')).length;
    const callRequested = leads.filter((l) => l.tags?.includes('Call Requested')).length;
    const unassigned = leads.filter((l) => !l.assignedTo).length;
    return { total, hot, replied, callRequested, unassigned };
  }, [leads]);

  const tiles = [
    { icon: Inbox, label: 'Total Email Leads', value: stats.total, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
    { icon: Flame, label: 'Hot (3+ Opens)', value: stats.hot, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    { icon: MessageSquareText, label: 'Replied', value: stats.replied, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { icon: PhoneCall, label: 'Requested a Call', value: stats.callRequested, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { icon: UserX, label: 'Unassigned', value: stats.unassigned, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <div key={t.label} className={cn('flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700', t.bg)}>
            <div className={cn('p-1.5 rounded-lg bg-white/60 dark:bg-slate-900/40', t.color)}>
              <Icon size={14} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.label}</p>
              <p className={cn('text-[15px] font-bold leading-none mt-0.5', t.color)}>{t.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SignalBadges({ lead }) {
  const isHot = lead.tags?.includes('Hot');
  const isReplied = lead.tags?.includes('Replied');
  const isCallRequested = lead.tags?.includes('Call Requested');
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {isHot && (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <Flame size={10} /> Hot
        </span>
      )}
      {isReplied && (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
          <MessageSquareText size={10} /> Replied
        </span>
      )}
      {isCallRequested && (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
          <PhoneCall size={10} /> Call Requested
        </span>
      )}
      {!isHot && !isReplied && !isCallRequested && <span className="text-[11px] text-slate-400 italic">—</span>}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function EmailLeadsView({ leads, users, onSelectLead, onUpdate }) {
  const [movingId, setMovingId] = useState(null);
  const [campaignFilter, setCampaignFilter] = useState('all');

  // Distinct campaigns present in this lead set, so leads from different
  // campaigns can be viewed separately instead of always mixed together.
  const campaignOptions = useMemo(() => {
    const names = new Set();
    leads.forEach((l) => { if (l.campaignAttribution?.name) names.add(l.campaignAttribution.name); });
    return [...names].sort();
  }, [leads]);

  const campaignFiltered = useMemo(() => {
    if (campaignFilter === 'all') return leads;
    if (campaignFilter === 'none') return leads.filter((l) => !l.campaignAttribution?.name);
    return leads.filter((l) => l.campaignAttribution?.name === campaignFilter);
  }, [leads, campaignFilter]);

  const sorted = useMemo(
    () => [...campaignFiltered].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [campaignFiltered]
  );

  const handleMoveToPipeline = async (lead) => {
    setMovingId(lead._id);
    try {
      await onUpdate(lead._id, { source: 'Manual' });
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div>
      <EmailLeadsSummary leads={campaignFiltered} />

      {campaignOptions.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={14} className="text-slate-450" />
          <select
            className="form-input text-[12.5px] py-1.5 w-auto"
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
          >
            <option value="all">All campaigns ({leads.length})</option>
            {campaignOptions.map((name) => (
              <option key={name} value={name}>
                {name} ({leads.filter((l) => l.campaignAttribution?.name === name).length})
              </option>
            ))}
            {leads.some((l) => !l.campaignAttribution?.name) && (
              <option value="none">
                Unknown campaign ({leads.filter((l) => !l.campaignAttribution?.name).length})
              </option>
            )}
          </select>
        </div>
      )}

      <div className="card overflow-hidden">
        {sorted.length === 0 ? (
          <div className="py-16 text-center">
            <Mail size={28} className="text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-slate-600 dark:text-slate-300">No email-engaged leads yet</p>
            <p className="text-[12.5px] text-slate-400 mt-1 max-w-sm mx-auto">
              Leads who open a campaign email 3+ times or reply to one show up here automatically —
              they never mix into the main pipeline unless you move them in.
            </p>
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Company / Contact</th>
                <th>Campaign</th>
                <th>Email</th>
                <th>Signal</th>
                <th>Opens</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Last Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((lead) => (
                <tr key={getId(lead)}>
                  <td>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{lead.companyName}</p>
                    <p className="text-[11.5px] text-slate-500">{lead.contactPerson}</p>
                  </td>
                  <td className="text-[12.5px] text-slate-600 dark:text-slate-400 max-w-[160px] truncate">
                    {lead.campaignAttribution?.name || <span className="text-slate-400 italic">Unknown</span>}
                  </td>
                  <td className="text-[12.5px] text-slate-600 dark:text-slate-400">{lead.email || '—'}</td>
                  <td><SignalBadges lead={lead} /></td>
                  <td className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-300">{lead.emailOpens || 0}</td>
                  <td><Badge variant="neutral">{lead.status}</Badge></td>
                  <td>
                    {lead.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar user={lead.assignedTo} size="xs" />
                        <span className="text-[12px] text-slate-600 dark:text-slate-400">{lead.assignedTo.name}</span>
                      </div>
                    ) : (
                      <span className="text-[11.5px] text-slate-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="text-[11.5px] text-slate-400 flex items-center gap-1">
                    <Clock size={11} />
                    {lead.lastContactDate ? new Date(lead.lastContactDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onSelectLead(lead)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        title="View details"
                      >
                        <Eye size={14} />
                      </button>
                      <Button
                        size="xs"
                        variant="outline"
                        loading={movingId === lead._id}
                        onClick={() => handleMoveToPipeline(lead)}
                        className="flex items-center gap-1"
                        title="Work this as a real deal in the main pipeline"
                      >
                        <ArrowRightCircle size={12} /> Move to Pipeline
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
