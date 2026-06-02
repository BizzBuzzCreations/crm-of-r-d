import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Search, RefreshCw, ChevronDown, ChevronUp,
  Calendar, X, User, Filter, Download, Clock,
} from 'lucide-react';
import { auditAPI } from '../services/api';
import useAppStore from '../store/useAppStore';
import { Page, Avatar, EmptyState } from '../components/ui';
import { cn, getId, sameId } from '../utils/helpers';

// ── Config ────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'auth',     label: 'Auth',     color: '#6366f1', bg: '#eef2ff' },
  { id: 'lead',     label: 'Lead',     color: '#f59e0b', bg: '#fffbeb' },
  { id: 'task',     label: 'Task',     color: '#3b82f6', bg: '#eff6ff' },
  { id: 'todo',     label: 'Todo',     color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'client',   label: 'Client',   color: '#10b981', bg: '#ecfdf5' },
  { id: 'user',     label: 'User',     color: '#f43f5e', bg: '#fff1f2' },
  { id: 'settings', label: 'Settings', color: '#64748b', bg: '#f8fafc' },
  { id: 'meeting',  label: 'Meeting',  color: '#06b6d4', bg: '#ecfeff' },
  { id: 'revenue',  label: 'Revenue',  color: '#4f46e5', bg: '#eef2ff' },
];

const ACTIONS = [
  { id: 'login',            label: 'Login',               color: '#6366f1', bg: '#eef2ff' },
  { id: 'logout',           label: 'Logout',              color: '#64748b', bg: '#f8fafc' },
  { id: 'create',           label: 'Created',             color: '#10b981', bg: '#ecfdf5' },
  { id: 'update',           label: 'Updated',             color: '#3b82f6', bg: '#eff6ff' },
  { id: 'delete',           label: 'Deleted',             color: '#ef4444', bg: '#fef2f2' },
  { id: 'assign',           label: 'Assigned',            color: '#f59e0b', bg: '#fffbeb' },
  { id: 'status_change',    label: 'Status Changed',      color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'email_sent',       label: 'Email Sent',          color: '#06b6d4', bg: '#ecfeff' },
  { id: 'approve',          label: 'Approved',            color: '#10b981', bg: '#ecfdf5' },
  { id: 'submit_approval',  label: 'Submitted for Approval', color: '#a855f7', bg: '#faf5ff' },
  { id: 'bulk_create',      label: 'Bulk Created',        color: '#14b8a6', bg: '#f0fdfa' },
  { id: 'merge',            label: 'Merged',              color: '#f97316', bg: '#fff7ed' },
];

function getCfg(list, id) {
  return list.find((x) => x.id === id) ?? { label: id, color: '#94a3b8', bg: '#f8fafc' };
}

// ── Small Badges ─────────────────────────────────────────────

function ActionBadge({ action }) {
  const cfg = getCfg(ACTIONS, action);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap select-none"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}
    >
      {cfg.label}
    </span>
  );
}

function CategoryBadge({ category }) {
  const cfg = getCfg(CATEGORIES, category);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap select-none"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}25` }}
    >
      {cfg.label}
    </span>
  );
}

// ── Date helpers ──────────────────────────────────────────────

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtAbs(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ── Stats Card ────────────────────────────────────────────────

function StatCard({ label, value, color, sub }) {
  return (
    <div className="card p-4 flex flex-col gap-1 min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none">{label}</p>
      <p className="text-[28px] font-black leading-none" style={{ color }}>{value ?? '—'}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

// ── Row detail expand ─────────────────────────────────────────

function LogDetail({ log }) {
  const hasChanges  = log.changes  && Object.keys(log.changes).length > 0;
  const hasMeta     = log.metadata && Object.keys(log.metadata).length > 0;
  if (!hasChanges && !hasMeta && !log.ip && !log.userAgent) return (
    <p className="text-[12px] text-slate-400 italic">No additional details.</p>
  );

  return (
    <div className="space-y-3">
      {/* Changes diff */}
      {hasChanges && (
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 select-none">Changes</p>
          <div className="space-y-1">
            {Object.entries(log.changes).map(([field, { from, to }]) => (
              <div key={field} className="flex items-start gap-2 text-[12.5px]">
                <span className="text-slate-500 font-semibold min-w-[90px] flex-shrink-0">{field}</span>
                <span className="text-red-400 line-through truncate max-w-[160px]" title={JSON.stringify(from)}>
                  {JSON.stringify(from) ?? '—'}
                </span>
                <span className="text-slate-400">→</span>
                <span className="text-emerald-500 font-medium truncate max-w-[160px]" title={JSON.stringify(to)}>
                  {JSON.stringify(to) ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {hasMeta && (
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 select-none">Metadata</p>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(log.metadata).map(([k, v]) => (
              <div key={k} className="flex gap-1.5 text-[12px]">
                <span className="text-slate-500 font-semibold">{k}:</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono truncate">
                  {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request context */}
      {(log.ip || log.userAgent) && (
        <div className="flex flex-wrap gap-4 text-[11.5px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/50">
          {log.ip && (
            <span
              className="flex items-center gap-1 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Click to copy"
              onClick={() => navigator.clipboard?.writeText(log.ip).catch(() => {})}
            >
              IP: <span className="font-mono text-slate-500">{log.ip}</span>
            </span>
          )}
          {log.userAgent && (
            <span className="truncate max-w-[400px]" title={log.userAgent}>
              UA: {log.userAgent.slice(0, 60)}{log.userAgent.length > 60 ? '…' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Log Row ───────────────────────────────────────────────────

function LogRow({ log, users }) {
  const [expanded, setExpanded] = useState(false);
  const actor = users.find((u) => sameId(u, log.actor?.id));

  return (
    <>
      <tr
        className={cn(
          'border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors',
          expanded && 'bg-slate-50 dark:bg-slate-800/30'
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Timestamp */}
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-300">
              {relativeTime(log.createdAt)}
            </span>
            <span className="text-[10.5px] text-slate-400 font-mono">
              {fmtAbs(log.createdAt)}
            </span>
          </div>
        </td>

        {/* Actor */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            {actor
              ? <Avatar user={actor} size="xs" />
              : <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 text-[10px] font-bold flex-shrink-0">?</div>
            }
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                {log.actor?.name ?? '—'}
              </p>
              <p className="text-[10.5px] text-slate-400 capitalize">{log.actor?.role ?? ''}</p>
            </div>
          </div>
        </td>

        {/* Action */}
        <td className="px-4 py-3 whitespace-nowrap">
          <ActionBadge action={log.action} />
        </td>

        {/* Category */}
        <td className="px-4 py-3 whitespace-nowrap">
          <CategoryBadge category={log.category} />
        </td>

        {/* Target */}
        <td className="px-4 py-3 max-w-[220px]">
          <div className="min-w-0">
            {log.target?.title ? (
              <p className="text-[12.5px] font-medium text-slate-700 dark:text-slate-300 truncate">
                {log.target.ref && (
                  <span className="text-slate-400 font-mono text-[11px] mr-1">{log.target.ref}</span>
                )}
                {log.target.title}
              </p>
            ) : (
              <span className="text-[12px] text-slate-400">—</span>
            )}
          </div>
        </td>

        {/* Expand toggle */}
        <td className="px-4 py-3 text-center">
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-slate-50/80 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-700/50">
          <td colSpan={6} className="px-6 py-4">
            <LogDetail log={log} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Pagination ────────────────────────────────────────────────

function Pagination({ pagination, onPage }) {
  const { page, pages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  const getPages = () => {
    const arr = [];
    const delta = 2;
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - page) <= delta) arr.push(i);
      else if (arr[arr.length - 1] !== '…') arr.push('…');
    }
    return arr;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700/50 text-[12.5px] text-slate-500 select-none">
      <span>{total > 0 ? `${from}–${to} of ${total.toLocaleString()} logs` : 'No logs'}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1}
          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          ←
        </button>
        {getPages().map((p, i) =>
          p === '…'
            ? <span key={`ell-${i}`} className="px-1 text-slate-400">…</span>
            : <button key={p} onClick={() => onPage(p)}
                className={cn('min-w-[30px] py-1 rounded-lg border text-[12px] font-semibold transition-colors',
                  p === page
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                )}>
                {p}
              </button>
        )}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages}
          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          →
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function LogsPage() {
  const users = useAppStore((s) => s.users);

  const [logs,       setLogs]       = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, pages: 0 });
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [filters,    setFilters]    = useState({
    search: '', category: '', action: '', actorId: '', dateFrom: '', dateTo: '',
  });
  const [page, setPage] = useState(1);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const autoRefreshRef = useRef(null);

  const fetchLogs = useCallback(async (pg = 1, flt = filters) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: 50, ...Object.fromEntries(Object.entries(flt).filter(([, v]) => v)) };
      const { data } = await auditAPI.getLogs(params);
      setLogs(data.data ?? []);
      setPagination(data.pagination ?? { total: 0, page: pg, limit: 50, pages: 0 });
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await auditAPI.getStats();
      setStats(data.data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Initial + filter-triggered load
  useEffect(() => {
    setPage(1);
    fetchLogs(1, filters);
  }, [filters]);

  // Stats load once on mount
  useEffect(() => { fetchStats(); }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => fetchLogs(page, filters), 30_000);
    return () => clearInterval(autoRefreshRef.current);
  }, [page, filters, fetchLogs]);

  const handlePage = (pg) => {
    setPage(pg);
    fetchLogs(pg, filters);
  };

  const handleRefresh = () => {
    fetchLogs(page, filters);
    fetchStats();
  };

  // CSV export
  const exportCSV = () => {
    const rows = [
      ['Timestamp', 'Actor', 'Role', 'Action', 'Category', 'Target', 'Ref', 'IP'],
      ...logs.map((l) => [
        fmtAbs(l.createdAt),
        l.actor?.name ?? '',
        l.actor?.role ?? '',
        l.action,
        l.category,
        l.target?.title ?? '',
        l.target?.ref ?? '',
        l.ip ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Top category by count
  const topCategory = stats?.byCategory?.[0];
  const topAction   = stats?.byAction?.[0];

  return (
    <Page>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 select-none">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <h1 className="page-title">Audit Logs</h1>
            <p className="page-sub">Real-time system activity — admin view only</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={loading}
            className="btn-outline btn-sm flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={exportCSV} disabled={logs.length === 0}
            className="btn-outline btn-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Logs"
          value={stats?.totalCount?.toLocaleString()}
          color="#6366f1"
          sub="all time"
        />
        <StatCard
          label="Today"
          value={stats?.todayCount?.toLocaleString()}
          color="#10b981"
          sub="since midnight"
        />
        <StatCard
          label="Top Category"
          value={topCategory ? getCfg(CATEGORIES, topCategory._id).label : '—'}
          color={topCategory ? getCfg(CATEGORIES, topCategory._id).color : '#94a3b8'}
          sub={topCategory ? `${topCategory.count} events (30d)` : 'last 30 days'}
        />
        <StatCard
          label="Top Action"
          value={topAction ? getCfg(ACTIONS, topAction._id).label : '—'}
          color={topAction ? getCfg(ACTIONS, topAction._id).color : '#94a3b8'}
          sub={topAction ? `${topAction.count} times (30d)` : 'last 30 days'}
        />
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-2.5 mb-5 flex-wrap items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="form-input pl-9 py-1.5 text-[13px]"
            placeholder="Search actor, target…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>

        {/* Category */}
        <select className="form-input w-[150px] text-[13px] py-1.5" value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>

        {/* Action */}
        <select className="form-input w-[180px] text-[13px] py-1.5" value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}>
          <option value="">All Actions</option>
          {ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>

        {/* User (actor) */}
        <select className="form-input w-[160px] text-[13px] py-1.5" value={filters.actorId}
          onChange={(e) => setFilters((f) => ({ ...f, actorId: e.target.value }))}>
          <option value="">All Users</option>
          {users.map((u) => (
            <option key={getId(u)} value={getId(u)}>{u.name} ({u.role})</option>
          ))}
        </select>

        {/* Date From */}
        <div className="relative flex items-center">
          <Calendar size={12} className="absolute left-3 text-slate-400 pointer-events-none z-10" />
          <input
            type="date"
            className={cn('form-input pl-8 pr-2 py-1.5 text-[13px] w-[155px] appearance-none cursor-pointer',
              filters.dateFrom ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : ''
            )}
            style={{ colorScheme: 'light' }}
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            title="From date"
          />
        </div>

        {/* Date To */}
        <div className="relative flex items-center">
          <Calendar size={12} className="absolute left-3 text-slate-400 pointer-events-none z-10" />
          <input
            type="date"
            className={cn('form-input pl-8 pr-2 py-1.5 text-[13px] w-[155px] appearance-none cursor-pointer',
              filters.dateTo ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : ''
            )}
            style={{ colorScheme: 'light' }}
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            title="To date"
          />
        </div>

        {/* Clear */}
        {activeFilters > 0 && (
          <button
            className="flex items-center gap-1 text-[12.5px] text-primary-500 hover:text-primary-600 font-medium"
            onClick={() => setFilters({ search: '', category: '', action: '', actorId: '', dateFrom: '', dateTo: '' })}
          >
            <X size={12} /> Clear {activeFilters > 1 ? `(${activeFilters})` : ''}
          </button>
        )}
      </div>

      {/* ── Active user stats strip (30d) ── */}
      {stats?.topActors?.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap select-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Most Active (30d):</span>
          {stats.topActors.slice(0, 6).map((a) => {
            const u = users.find((x) => sameId(x, a._id));
            return (
              <button
                key={String(a._id)}
                onClick={() => setFilters((f) => ({ ...f, actorId: String(a._id) }))}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11.5px] font-medium border transition-all',
                  filters.actorId === String(a._id)
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                )}
                title={`${a.count} actions`}
              >
                {u ? <img src={u.avatar} className="w-4 h-4 rounded-full" onError={(e) => { e.target.style.display = 'none'; }} alt="" /> : null}
                {a.name.split(' ')[0]}
                <span className="text-[10px] text-slate-400 font-mono">{a.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-slate-400 text-[13px]">
            <RefreshCw size={14} className="animate-spin" /> Loading logs…
          </div>
        )}

        {!loading && logs.length === 0 && (
          <EmptyState
            icon={Shield}
            title={activeFilters ? 'No logs match your filters' : 'No audit logs yet'}
            description={activeFilters ? 'Try adjusting or clearing the filters.' : 'Activity will appear here as the team uses the CRM.'}
          />
        )}

        {!loading && logs.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 whitespace-nowrap select-none">
                      <div className="flex items-center gap-1.5"><Clock size={11} /> Timestamp</div>
                    </th>
                    <th className="px-4 py-3 select-none">
                      <div className="flex items-center gap-1.5"><User size={11} /> Actor</div>
                    </th>
                    <th className="px-4 py-3 select-none">Action</th>
                    <th className="px-4 py-3 select-none">Category</th>
                    <th className="px-4 py-3 select-none">Target</th>
                    <th className="px-4 py-3 text-center select-none w-10">Details</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {logs.map((log) => (
                      <LogRow key={log._id} log={log} users={users} />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            <Pagination pagination={pagination} onPage={handlePage} />
          </>
        )}
      </div>
    </Page>
  );
}
