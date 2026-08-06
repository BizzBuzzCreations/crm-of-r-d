import { useMemo, useState } from 'react';
import { Globe2, UserX, Sparkles, Trophy } from 'lucide-react';
import { cn } from '../utils/helpers';
import LeadsTableView from './LeadsTableView';

// ── Stat tiles — scoped ONLY to public-form-sourced leads (source === 'Web
// Form'), independent of the main B2B Leads Pipeline's own stats. Mirrors
// EmailLeadsView's EmailLeadsSummary — same idea, different signals, since
// these leads don't have campaign opens/replies, just intake fields.
function ExternalFormLeadsSummary({ leads }) {
  const stats = useMemo(() => {
    const total = leads.length;
    const unassigned = leads.filter((l) => !l.assignedTo).length;
    const fresh = leads.filter((l) => l.status === 'New Lead').length;
    const won = leads.filter((l) => l.status === 'Won').length;
    const sites = new Set(leads.map((l) => l.utmSource).filter(Boolean)).size;
    return { total, unassigned, fresh, won, sites };
  }, [leads]);

  const tiles = [
    { icon: Globe2, label: 'Total Form Leads', value: stats.total, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
    { icon: Sparkles, label: 'New / Uncontacted', value: stats.fresh, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { icon: Trophy, label: 'Won', value: stats.won, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { icon: UserX, label: 'Unassigned', value: stats.unassigned, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { icon: Globe2, label: 'Source Sites', value: stats.sites, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
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

// ── Main ─────────────────────────────────────────────────────
// Leads captured by a public intake form (Website Intelligence's
// /api/wit/lead, or the standalone /api/lead-capture) — kept in their own
// tab, fully separate from the main pipeline's grid/stats/Kanban/Forecast
// views, until someone explicitly moves one in ("Move to Pipeline" — same
// mechanism as Email Leads, flips source away from 'Web Form'). Reversible
// from either grid via the "Move back" button, since utmSource is set once
// at creation and never cleared.
//
// The grid itself is just LeadsTableView, reused as-is — same spreadsheet
// look, sorting, inline editing, column toggle, archive view, Export CSV as
// the main Pipeline tab, rather than a second, weaker table implementation.
// It already has Debt Amount / Preferred Contact / Situation / Source
// Website as real columns (see LeadsTableView's ALL_COLUMNS), so nothing
// extra was needed there for this tab specifically.
export default function ExternalFormLeadsView({ leads, allLeads, users, onSelectLead, onDelete, onUpdate }) {
  const [siteFilter, setSiteFilter] = useState('all');

  // Distinct source sites present in this lead set, so leads from
  // different sites can be viewed separately instead of always mixed.
  const siteOptions = useMemo(() => {
    const names = new Set();
    leads.forEach((l) => { if (l.utmSource) names.add(l.utmSource); });
    return [...names].sort();
  }, [leads]);

  const siteFiltered = useMemo(() => {
    if (siteFilter === 'all') return leads;
    if (siteFilter === 'none') return leads.filter((l) => !l.utmSource);
    return leads.filter((l) => l.utmSource === siteFilter);
  }, [leads, siteFilter]);

  return (
    <div>
      <ExternalFormLeadsSummary leads={siteFiltered} />

      {siteOptions.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <Globe2 size={14} className="text-slate-450" />
          <select
            className="form-input text-[12.5px] py-1.5 w-auto"
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
          >
            <option value="all">All sites ({leads.length})</option>
            {siteOptions.map((name) => (
              <option key={name} value={name}>
                {name} ({leads.filter((l) => l.utmSource === name).length})
              </option>
            ))}
            {leads.some((l) => !l.utmSource) && (
              <option value="none">
                Unknown site ({leads.filter((l) => !l.utmSource).length})
              </option>
            )}
          </select>
        </div>
      )}

      <LeadsTableView
        filteredLeads={siteFiltered}
        allLeads={allLeads}
        users={users}
        onSelectLead={onSelectLead}
        onDelete={onDelete}
        onUpdate={onUpdate}
        variant="externalForm"
      />
    </div>
  );
}
