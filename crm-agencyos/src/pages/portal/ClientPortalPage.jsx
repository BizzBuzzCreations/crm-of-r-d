import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  CheckSquare, Clock, AlertCircle, ThumbsUp, BarChart3,
  FolderOpen, Video, RefreshCw, Building2, TrendingUp, ListTodo,
  X, Paperclip, Tag, User, Calendar, Hash, Layers, Eye, Download, FileText, IndianRupee,
} from 'lucide-react';
import { portalAPI, getBackendUrl } from '../../services/api';
import { Page, Avatar, Tabs, Skeleton, EmptyState, Button } from '../../components/ui';
import useAppStore from '../../store/useAppStore';
import { cn, getId, PRIORITY_CONFIG, STATUS_CONFIG } from '../../utils/helpers';

// ── Status color pill ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, tw: 'badge-neutral' };
  return <span className={`badge ${cfg.tw} capitalize`}>{cfg.label}</span>;
}

// ── Priority dot ───────────────────────────────────────────────────
function PriorityDot({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: cfg.color }}
      title={cfg.label}
    />
  );
}

// ── Stat card ──────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex items-center gap-4 py-4 px-5"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '18' }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[24px] font-bold text-slate-800 dark:text-slate-100 leading-none">{value}</p>
        <p className="text-[12px] text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ── Progress ring ──────────────────────────────────────────────────
function ProgressRing({ pct, color = '#6366f1', size = 48 }) {
  const r   = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

// ── Project card ───────────────────────────────────────────────────
const STATUS_COLORS = {
  pending:       '#f59e0b',
  'in-progress': '#6366f1',
  completed:     '#10b981',
  'on-hold':     '#94a3b8',
};

function ProjectCard({ project, stats }) {
  const pct   = stats?.progress ?? 0;
  const color = STATUS_COLORS[project.status] || '#6366f1';
  return (
    <div className="p-4 border-b border-slate-100 dark:border-slate-800 last:border-0">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <ProgressRing pct={pct} color={color} size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">{project.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: color + '18', color }}
            >
              {project.status?.replace(/-/g, ' ') || 'pending'}
            </span>
            {project.endDate && (
              <span className="text-[10.5px] text-slate-400">Due {project.endDate}</span>
            )}
          </div>

          {/* Task breakdown mini-bar */}
          {stats && stats.total > 0 && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">{stats.completed}/{stats.total} tasks done</span>
                <span className="text-[11px] font-bold" style={{ color }}>{pct}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: color }}
                />
              </div>
              {/* Status breakdown dots */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {stats.inProgress > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                    {stats.inProgress} in progress
                  </span>
                )}
                {stats.pending > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    {stats.pending} pending
                  </span>
                )}
                {stats.forApproval > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
                    {stats.forApproval} for approval
                  </span>
                )}
              </div>
            </div>
          )}

          {/* No tasks yet */}
          {(!stats || stats.total === 0) && (
            <p className="text-[10.5px] text-slate-400 mt-1.5 italic">No tasks assigned yet</p>
          )}

          {/* Team avatars */}
          {project.assignedTeam?.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {project.assignedTeam.slice(0, 5).map((u) => (
                <Avatar key={u._id} user={u} size="xs" />
              ))}
              {project.assignedTeam.length > 5 && (
                <span className="text-[10px] text-slate-400 ml-0.5">+{project.assignedTeam.length - 5}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Task row ───────────────────────────────────────────────────────
function TaskRow({ task, onClick }) {
  return (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors cursor-pointer"
    >
      <PriorityDot priority={task.priority} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-slate-700 dark:text-slate-300 truncate font-medium">{task.title}</p>
        {task.dueDate && (
          <p className="text-[10.5px] text-slate-400 mt-0.5">Due {task.dueDate}</p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Progress bar */}
        <div className="hidden sm:flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${task.progress || 0}%`, background: PRIORITY_CONFIG[task.priority]?.color || '#6366f1' }}
            />
          </div>
          <span className="text-[10.5px] text-slate-400 w-7">{task.progress || 0}%</span>
        </div>
        <StatusBadge status={task.status} />
      </div>
    </div>
  );
}

// ── Todo row ───────────────────────────────────────────────────────
function TodoRow({ todo, onClick }) {
  return (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors cursor-pointer"
    >
      <PriorityDot priority={todo.priority} />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-slate-700 dark:text-slate-300 truncate">{todo.title}</p>
        {todo.dueDate && (
          <p className="text-[10px] text-slate-400 mt-0.5">Due {todo.dueDate}</p>
        )}
      </div>
      <StatusBadge status={todo.status} />
    </div>
  );
}

// ── Meeting row ────────────────────────────────────────────────────
function MeetingRow({ meeting }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center flex-shrink-0">
        <Video size={14} className="text-indigo-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">{meeting.title}</p>
        <p className="text-[10.5px] text-slate-400 mt-0.5">
          {meeting.date}{meeting.time ? ` · ${meeting.time}` : ''}{meeting.duration ? ` · ${meeting.duration}` : ''}
        </p>
      </div>
      <span className={cn(
        'text-[10.5px] font-semibold px-2 py-0.5 rounded-full',
        meeting.status === 'upcoming'
          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-500',
      )}>
        {meeting.status}
      </span>
    </div>
  );
}

// ── Shared detail field ────────────────────────────────────────────
function DetailField({ label, value, icon: Icon }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />}
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-[13px] text-slate-700 dark:text-slate-300 break-words">{value}</p>
      </div>
    </div>
  );
}

// ── Read-only Task detail modal ────────────────────────────────────
function TaskDetailModal({ task, onClose }) {
  if (!task) return null;
  const base    = getBackendUrl();
  const pCfg    = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const sCfg    = STATUS_CONFIG[task.status]     || { label: task.status, tw: 'badge-neutral' };
  const assignee = task.assignedTo;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
          initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: pCfg.color + '18' }}>
                <CheckSquare size={15} style={{ color: pCfg.color }} />
              </div>
              <div className="min-w-0">
                {task.taskNumber && (
                  <p className="text-[10px] text-slate-400 font-mono mb-0.5">#{task.taskNumber}</p>
                )}
                <h2 className="text-[14px] font-bold text-slate-800 dark:text-slate-100 leading-snug">{task.title}</h2>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-650 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0 ml-2">
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto p-5 space-y-4">
            {/* Status + Priority */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${sCfg.tw}`}>{sCfg.label}</span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: pCfg.color + '18', color: pCfg.color }}>
                {pCfg.label} priority
              </span>
            </div>

            {/* Progress */}
            {(task.progress ?? 0) > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-505">Progress</span>
                  <span className="text-[11px] font-semibold text-indigo-500">{task.progress}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-505 transition-all" style={{ width: `${task.progress}%` }} />
                </div>
              </div>
            )}

            {/* Description */}
            {task.description && (
              <div>
                <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</p>
                <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Assigned to" value={assignee?.name} icon={User} />
              <DetailField label="Project"     value={task.projectId?.name} icon={Layers} />
              <DetailField label="Start date"  value={task.startDate}   icon={Calendar} />
              <DetailField label="Due date"    value={task.dueDate}     icon={Calendar} />
            </div>

            {/* Tags */}
            {task.tags?.length > 0 && (
              <div className="flex items-start gap-2">
                <Tag size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map((t) => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-505">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Attachments */}
            {task.attachments?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Paperclip size={12} className="text-slate-400" />
                  <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">Attachments</span>
                </div>
                <div className="space-y-1.5">
                  {task.attachments.map((att, i) => {
                    const url = att.type === 'link' ? att.url : (att.url?.startsWith('http') ? att.url : `${base}${att.url}`);
                    return (
                      <a key={i} href={url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-55 dark:hover:bg-slate-800 transition-colors">
                        <Paperclip size={12} className="text-slate-400 flex-shrink-0" />
                        <span className="text-[12px] text-indigo-600 dark:text-indigo-405 truncate flex-1">{att.name || att.url}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Read-only footer */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 rounded-b-2xl">
            <p className="text-[11px] text-slate-400 text-center">Read-only — contact your account manager to request changes</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Read-only Todo detail modal ────────────────────────────────────
function TodoDetailModal({ todo, onClose }) {
  if (!todo) return null;
  const base = getBackendUrl();
  const pCfg = PRIORITY_CONFIG[todo.priority] || PRIORITY_CONFIG.medium;
  const sCfg = STATUS_CONFIG[todo.status]     || { label: todo.status, tw: 'badge-neutral' };
  const owner = todo.userId;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
          initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: pCfg.color + '18' }}>
                <ListTodo size={15} style={{ color: pCfg.color }} />
              </div>
              <h2 className="text-[14px] font-bold text-slate-800 dark:text-slate-100 leading-snug">{todo.title}</h2>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-650 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0 ml-2">
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto p-5 space-y-4">
            {/* Status + Priority */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${sCfg.tw}`}>{sCfg.label}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: pCfg.color + '18', color: pCfg.color }}>
                {pCfg.label} priority
              </span>
            </div>

            {/* Description */}
            {todo.description && (
              <div>
                <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</p>
                <p className="text-[13px] text-slate-606 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{todo.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Assigned to" value={owner?.name}      icon={User} />
              {todo.taskId?.title && <DetailField label="Related task" value={`#${todo.taskId.taskNumber || ''} ${todo.taskId.title}`} icon={Hash} />}
              <DetailField label="Start date"  value={todo.startDate}  icon={Calendar} />
              <DetailField label="Due date"    value={todo.dueDate}    icon={Calendar} />
            </div>

            {/* Attachments */}
            {todo.attachments?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Paperclip size={12} className="text-slate-400" />
                  <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">Attachments</span>
                </div>
                <div className="space-y-1.5">
                  {todo.attachments.map((att, i) => {
                    const url = att.type === 'link' ? att.url : (att.url?.startsWith('http') ? att.url : `${base}${att.url}`);
                    return (
                      <a key={i} href={url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-55 dark:hover:bg-slate-800 transition-colors">
                        <Paperclip size={12} className="text-slate-400 flex-shrink-0" />
                        <span className="text-[12px] text-indigo-600 dark:text-indigo-405 truncate flex-1">{att.name || att.url}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 rounded-b-2xl">
            <p className="text-[11px] text-slate-400 text-center">Read-only — contact your account manager to request changes</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Read-only Portal Invoice Drawer ────────────────────────────────
function PortalInvoiceDrawer({ invoiceId, open, onClose }) {
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && invoiceId) {
      setLoading(true);
      portalAPI.invoice(invoiceId)
        .then((r) => {
          setInvoice(r.data.data);
          setPayments(r.data.payments || []);
        })
        .catch(() => {
          toast.error('Failed to load invoice details');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, invoiceId]);

  if (!open || !invoiceId) return null;

  const STATUS_CFG = {
    draft:          { label: 'Draft',          color: 'bg-slate-100 dark:bg-slate-500/20 text-slate-650 dark:text-slate-300 border-slate-205 dark:border-slate-500/30' },
    sent:           { label: 'Sent',           color: 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-105 dark:border-blue-500/30' },
    partially_paid: { label: 'Partial',        color: 'bg-amber-50 dark:bg-amber-500/20 text-amber-705 dark:text-amber-300 border-amber-105 dark:border-amber-500/30' },
    paid:           { label: 'Paid',           color: 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-105 dark:border-emerald-500/30' },
    overdue:        { label: 'Overdue',        color: 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 border-red-105 dark:border-red-500/30' },
    cancelled:      { label: 'Cancelled',      color: 'bg-slate-100 dark:bg-slate-600/20 text-slate-500 dark:text-slate-405 border-slate-205 dark:border-slate-600/30' },
  };

  const fmt = (n, cur = 'INR') => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur || 'INR', maximumFractionDigits: 0 }).format(n || 0);
  };

  const StatusPill = ({ status }) => {
    const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border shadow-sm', cfg.color)}>
        {cfg.label}
      </span>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div
        className="fixed right-0 top-0 h-full w-[520px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-50 flex flex-col overflow-hidden shadow-2xl"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-3/4 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : invoice ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400 text-[12px] font-mono font-semibold">#{invoice.invoiceNumber}</span>
                  <StatusPill status={invoice.status} />
                </div>
                <h2 className="text-slate-900 dark:text-white font-bold text-[16px] mt-1.5 truncate max-w-[280px]">{invoice.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(portalAPI.pdfUrl(invoice._id) + '?token=' + localStorage.getItem('crm_access_token'), '_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-lg text-[12px] font-semibold transition-colors"
                  title="Download PDF"
                >
                  <Download size={13} /> PDF
                </button>
                <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-650 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Key figures */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total',   val: fmt(invoice.total, invoice.currency),      color: 'text-slate-900 dark:text-white' },
                  { label: 'Paid',    val: fmt(invoice.paidAmount, invoice.currency),  color: 'text-emerald-600 dark:text-emerald-450' },
                  { label: 'Balance', val: fmt(invoice.balanceDue, invoice.currency),  color: invoice.balanceDue > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-slate-55 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-xl p-3.5 text-center shadow-sm">
                    <div className="text-slate-550 dark:text-slate-450 text-[11px] font-bold uppercase tracking-wider mb-1">{label}</div>
                    <div className={cn('font-mono font-bold text-[14.5px]', color)}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Dates */}
              <div className="flex gap-6 text-[12.5px] bg-slate-55 dark:bg-slate-800/20 border border-slate-150 dark:border-slate-850 rounded-xl px-4 py-3">
                <div><span className="text-slate-505 dark:text-slate-455 font-medium">Issued: </span><span className="text-slate-800 dark:text-slate-200 font-semibold">{invoice.issueDate ? new Date(invoice.issueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span></div>
                <div><span className="text-slate-505 dark:text-slate-455 font-medium">Due: </span><span className="text-slate-800 dark:text-slate-200 font-semibold">{invoice.dueDate ? new Date(invoice.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span></div>
              </div>

              {/* Line items */}
              <div>
                <div className="text-[11.5px] text-slate-500 dark:text-slate-450 mb-2.5 font-bold uppercase tracking-wider">Line Items</div>
                <div className="space-y-2">
                  {invoice.lineItems?.map((li, i) => (
                    <div key={i} className="flex items-center justify-between text-[13px] bg-slate-50/50 dark:bg-slate-85/20 border border-slate-150 dark:border-slate-800/40 rounded-xl px-4 py-3">
                      <div className="text-slate-800 dark:text-slate-300 font-medium flex-1">{li.description}</div>
                      <div className="text-slate-505 dark:text-slate-455 text-right ml-4 flex-shrink-0 font-mono">
                        {li.quantity} × {fmt(li.rate, invoice.currency)} = <span className="text-slate-900 dark:text-slate-200 font-semibold font-mono">{fmt(li.amount, invoice.currency)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-3 mt-3 space-y-1.5 px-2">
                    <div className="flex justify-between text-[12.5px] text-slate-550 dark:text-slate-450"><span>Subtotal</span><span className="font-mono text-slate-700 dark:text-slate-300">{fmt(invoice.subtotal, invoice.currency)}</span></div>
                    {invoice.taxRate > 0 && <div className="flex justify-between text-[12.5px] text-slate-550 dark:text-slate-455"><span>Tax ({invoice.taxRate}%)</span><span className="font-mono text-slate-700 dark:text-slate-300">{fmt(invoice.taxAmount, invoice.currency)}</span></div>}
                    {invoice.discount > 0 && <div className="flex justify-between text-[12.5px] text-slate-550 dark:text-slate-455"><span>Discount</span><span className="font-mono text-red-500 dark:text-red-400 font-medium">-{fmt(invoice.discount, invoice.currency)}</span></div>}
                    <div className="flex justify-between text-[13.5px] text-slate-900 dark:text-white font-bold border-t border-slate-100 dark:border-slate-800 pt-1.5 mt-1.5"><span>Total</span><span className="font-mono text-indigo-600 dark:text-indigo-400">{fmt(invoice.total, invoice.currency)}</span></div>
                  </div>
                </div>
              </div>

              {/* Payments */}
              <div>
                <div className="text-[11.5px] text-slate-550 dark:text-slate-450 font-bold uppercase tracking-wider mb-2.5">Payment History</div>
                {payments.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-[13px] bg-slate-55 dark:bg-slate-800/30 border border-slate-150 dark:border-slate-850 rounded-xl px-4 py-3 text-center">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {payments.map((p) => (
                      <div key={p._id} className="flex items-center justify-between bg-slate-55 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-sm">
                        <div>
                          <div className="text-[13.5px] font-mono font-bold text-emerald-600 dark:text-emerald-450">{fmt(p.amount, invoice.currency)}</div>
                          <div className="text-[11.5px] text-slate-550 dark:text-slate-455 mt-0.5">
                            {p.paymentDate ? new Date(p.paymentDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} · {p.method?.replace(/_/g, ' ').toUpperCase()}
                            {p.reference && ` · Ref: ${p.reference}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes / Terms */}
              {(invoice.notes || invoice.terms) && (
                <div className="space-y-4 bg-slate-55 dark:bg-slate-805/10 border border-slate-150 dark:border-slate-850/50 rounded-xl p-4">
                  {invoice.notes && (
                    <div>
                      <div className="text-[11.5px] text-slate-550 dark:text-slate-450 mb-1 font-bold uppercase tracking-wider">Notes</div>
                      <p className="text-[13px] text-slate-650 dark:text-slate-405 leading-relaxed">{invoice.notes}</p>
                    </div>
                  )}
                  {invoice.terms && (
                    <div>
                      <div className="text-[11.5px] text-slate-550 dark:text-slate-450 mb-1 font-bold uppercase tracking-wider">Terms</div>
                      <p className="text-[13px] text-slate-655 dark:text-slate-405 leading-relaxed">{invoice.terms}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-6 text-center text-slate-500">Invoice not found</div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ── Portal Billing / Invoices Tab ──────────────────────────────────
function PortalBillingTab({ setActiveInvoiceId, setDrawerOpen }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data } = await portalAPI.invoices();
      setInvoices(data.data || []);
    } catch {
      toast.error('Failed to load invoices');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const STATUS_CFG = {
    draft:          { label: 'Draft',          color: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-350 border-slate-205 dark:border-slate-500/30' },
    sent:           { label: 'Sent',           color: 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-105 dark:border-blue-500/30' },
    partially_paid: { label: 'Partial',        color: 'bg-amber-50 dark:bg-amber-500/20 text-amber-705 dark:text-amber-300 border-amber-105 dark:border-amber-500/30' },
    paid:           { label: 'Paid',           color: 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-105 dark:border-emerald-500/30' },
    overdue:        { label: 'Overdue',        color: 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 border-red-105 dark:border-red-500/30' },
    cancelled:      { label: 'Cancelled',      color: 'bg-slate-100 dark:bg-slate-600/20 text-slate-500 dark:text-slate-405 border-slate-205 dark:border-slate-600/30' },
  };

  const StatusPill = ({ status }) => {
    const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border shadow-sm', cfg.color)}>
        {cfg.label}
      </span>
    );
  };

  const fmt = (n, cur = 'INR') => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur || 'INR', maximumFractionDigits: 0 }).format(n || 0);
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-3 p-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No invoices found"
        description="We haven't generated any invoices for your account yet."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-sm bg-white dark:bg-slate-900/20">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800/60 text-slate-505 dark:text-slate-450 text-[11px] font-semibold uppercase tracking-wide">
            {['#', 'Invoice Title', 'Status', 'Issued Date', 'Due Date', 'Total', 'Balance Due', 'Actions'].map(h => (
              <th key={h} className={cn('px-4 py-3 text-left', h === 'Total' || h === 'Balance Due' ? 'text-right' : '')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-150 dark:divide-slate-800/40">
          {invoices.map((inv) => (
            <tr
              key={inv._id}
              className="hover:bg-slate-50/80 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
              onClick={() => { setActiveInvoiceId(inv._id); setDrawerOpen(true); }}
            >
              <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 text-[12px]">#{inv.invoiceNumber}</td>
              <td className="px-4 py-3 text-slate-900 dark:text-white font-medium max-w-[200px] truncate">{inv.title}</td>
              <td className="px-4 py-3"><StatusPill status={inv.status} /></td>
              <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-[12px]">{fmtDate(inv.issueDate)}</td>
              <td className={cn('px-4 py-3 text-[12px]', inv.status === 'overdue' ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-slate-500 dark:text-slate-405')}>
                {fmtDate(inv.dueDate)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-705 dark:text-slate-300">{fmt(inv.total, inv.currency)}</td>
              <td className={cn('px-4 py-3 text-right font-mono font-semibold', inv.balanceDue > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-450')}>
                {fmt(inv.balanceDue, inv.currency)}
              </td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1.5">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => { setActiveInvoiceId(inv._id); setDrawerOpen(true); }}
                    title="View Details"
                  >
                    <Eye size={12} />
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => window.open(portalAPI.pdfUrl(inv._id) + '?token=' + localStorage.getItem('crm_access_token'), '_blank')}
                    title="Download PDF"
                  >
                    <Download size={12} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function ClientPortalPage() {
  const authUser = useAppStore((s) => s.authUser);
  const tasks    = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);
  const meetings = useAppStore((s) => s.meetings);
  const todos    = useAppStore((s) => s.todos);

  const [overview, setOverview]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [activeTodo, setActiveTodo] = useState(null);
  
  const [tab, setTab] = useState('overview');
  const [activeInvoiceId, setActiveInvoiceId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchOverview = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const { data } = await portalAPI.overview();
      setOverview(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load portal data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchOverview(); }, []);

  // Derive stats from store data (always fresh after socket updates)
  const taskStats = {
    total:       tasks.length,
    completed:   tasks.filter((t) => t.status === 'completed').length,
    inProgress:  tasks.filter((t) => t.status === 'in-progress').length,
    pending:     tasks.filter((t) => t.status === 'pending').length,
    forApproval: tasks.filter((t) => t.status === 'sent-for-approval').length,
    avgProgress: tasks.length
      ? Math.round(tasks.reduce((a, t) => a + (t.progress || 0), 0) / tasks.length)
      : 0,
  };

  const upcomingMeetings = meetings
    .filter((m) => m.status === 'upcoming')
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    .slice(0, 5);

  // Compute real progress for every project from its tasks
  const projectStats = projects.reduce((acc, proj) => {
    const pid  = getId(proj);
    const pts  = tasks.filter((t) => t.projectId && getId(t.projectId) === pid);
    const total       = pts.length;
    const completed   = pts.filter((t) => t.status === 'completed').length;
    const inProgress  = pts.filter((t) => t.status === 'in-progress').length;
    const pending     = pts.filter((t) => t.status === 'pending').length;
    const forApproval = pts.filter((t) => t.status === 'sent-for-approval').length;
    const progress    = total
      ? Math.round(pts.reduce((s, t) => s + (t.progress ?? 0), 0) / total)
      : 0;
    acc[pid] = { total, completed, inProgress, pending, forApproval, progress };
    return acc;
  }, {});

  const todoStats = {
    total:     todos.length,
    completed: todos.filter((t) => t.status === 'completed').length,
    pending:   todos.filter((t) => t.status === 'pending').length,
  };

  const clientName = overview?.client?.name || authUser?.name || 'Client';

  if (loading) {
    return (
      <Page>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-505 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading your portal…</p>
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <div className="card flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle size={36} className="text-red-400" />
          <p className="text-slate-505">{error}</p>
          <button onClick={() => fetchOverview()} className="btn btn-primary text-sm">Retry</button>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      {/* ── Header ── */}
      <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="page-title leading-tight">{clientName}</h1>
            <p className="page-sub">Your project portal — read-only view</p>
          </div>
        </div>
        <button
          onClick={() => fetchOverview(true)}
          disabled={refreshing}
          className="btn btn-ghost text-sm flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'billing',  label: 'Invoices & Billing' },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-5"
      />

      {/* ── Tab Contents ── */}
      {tab === 'overview' && (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard label="Total Tasks"    value={taskStats.total}       icon={CheckSquare} color="#6366f1" />
            <StatCard label="Completed"      value={taskStats.completed}   icon={CheckSquare} color="#10b981" />
            <StatCard label="In Progress"    value={taskStats.inProgress}  icon={Clock}       color="#3b82f6" />
            <StatCard label="For Approval"   value={taskStats.forApproval} icon={ThumbsUp}    color="#f59e0b" />
            <StatCard
              label="Avg Completion"
              value={`${taskStats.avgProgress}%`}
              icon={TrendingUp}
              color="#8b5cf6"
              sub="across all tasks"
            />
            <StatCard label="Todos"          value={todoStats.total}       icon={ListTodo}    color="#14b8a6" sub={`${todoStats.completed} done`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Overall progress bar */}
              {tasks.length > 0 && (() => {
                const completionPct = Math.round((taskStats.completed / taskStats.total) * 100);
                return (
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Overall Completion</span>
                      <span className="text-[15px] font-bold text-indigo-505">{completionPct}%</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-3">
                      {taskStats.completed} of {taskStats.total} tasks marked completed
                    </p>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${completionPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      />
                    </div>
                    {taskStats.avgProgress > 0 && taskStats.avgProgress !== completionPct && (
                      <>
                        <div className="flex items-center justify-between mt-3 mb-1">
                          <span className="text-[11px] text-slate-500">Avg task-level progress</span>
                          <span className="text-[11px] font-semibold text-slate-550">{taskStats.avgProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${taskStats.avgProgress}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                            className="h-full rounded-full bg-indigo-300 dark:bg-indigo-700"
                          />
                        </div>
                      </>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-[10.5px] text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />{taskStats.completed} completed</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />{taskStats.inProgress} in progress</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{taskStats.pending} pending</span>
                      {taskStats.forApproval > 0 && (
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />{taskStats.forApproval} for approval</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Tasks list */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-[13.5px] font-bold text-slate-705 dark:text-slate-200 flex items-center gap-2">
                    <CheckSquare size={15} className="text-indigo-400" />
                    Tasks
                  </h2>
                  <span className="text-[11px] text-slate-400">{tasks.length} total</span>
                </div>

                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-600">
                    <CheckSquare size={36} className="mb-3" />
                    <p className="text-sm text-slate-400">No tasks assigned yet</p>
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    {['in-progress', 'sent-for-approval', 'pending', 'completed'].map((status) => {
                      const group = tasks.filter((t) => t.status === status);
                      if (!group.length) return null;
                      const cfg = STATUS_CONFIG[status];
                      return (
                        <div key={status}>
                          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                            <span className={`badge ${cfg?.tw || 'badge-neutral'} text-[10px]`}>{cfg?.label || status}</span>
                            <span className="text-[10.5px] text-slate-400 ml-2">{group.length}</span>
                          </div>
                          {group.map((task) => <TaskRow key={task._id || task.id} task={task} onClick={() => setActiveTask(task)} />)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Meetings */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-[13.5px] font-bold text-slate-705 dark:text-slate-202 flex items-center gap-2">
                    <Video size={15} className="text-indigo-400" />
                    Upcoming Meetings
                  </h2>
                  <span className="text-[11px] text-slate-400">{upcomingMeetings.length}</span>
                </div>
                {upcomingMeetings.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
                    No upcoming meetings
                  </div>
                ) : (
                  upcomingMeetings.map((m) => <MeetingRow key={m._id || m.id} meeting={m} />)
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-[13.5px] font-bold text-slate-705 dark:text-slate-202 flex items-center gap-2">
                    <FolderOpen size={15} className="text-indigo-400" />
                    Projects
                  </h2>
                  <span className="text-[11px] text-slate-400">{projects.length}</span>
                </div>
                {projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-600">
                    <FolderOpen size={32} className="mb-3" />
                    <p className="text-sm text-slate-400">No projects yet</p>
                  </div>
                ) : (
                  <div>
                    {projects.map((p) => (
                      <ProjectCard
                        key={p._id || p.id}
                        project={p}
                        stats={projectStats[getId(p)]}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Todos card */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-[13.5px] font-bold text-slate-705 dark:text-slate-202 flex items-center gap-2">
                    <ListTodo size={15} className="text-indigo-400" />
                    Todos
                  </h2>
                  <span className="text-[11px] text-slate-400">{todoStats.total} total</span>
                </div>
                {todos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-300 dark:text-slate-650">
                    <ListTodo size={28} className="mb-2" />
                    <p className="text-sm text-slate-400">No todos yet</p>
                  </div>
                ) : (
                  <div className="max-h-[320px] overflow-y-auto">
                    {['in-progress', 'sent-for-approval', 'pending', 'completed'].map((status) => {
                      const group = todos.filter((t) => t.status === status);
                      if (!group.length) return null;
                      const cfg = STATUS_CONFIG[status];
                      return (
                        <div key={status}>
                          <div className="px-4 py-1.5 bg-slate-55 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                            <span className={`badge ${cfg?.tw || 'badge-neutral'} text-[10px]`}>{cfg?.label || status}</span>
                            <span className="text-[10px] text-slate-450 ml-2">{group.length}</span>
                          </div>
                          {group.map((todo) => <TodoRow key={todo._id || todo.id} todo={todo} onClick={() => setActiveTodo(todo)} />)}
                        </div>
                      );
                    })}
                  </div>
                )}
                {todos.length > 0 && (
                  <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="flex items-center justify-between text-[10.5px] text-slate-400">
                      <span>{todoStats.completed} completed</span>
                      <span>{todoStats.pending} pending</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Legend */}
              <div className="card p-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Priority Legend</p>
                <div className="space-y-2">
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: v.color }} />
                      <span className="text-[12px] text-slate-605 dark:text-slate-400 capitalize">{k}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10.5px] text-slate-450 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  This portal is read-only. Contact your account manager to request changes.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'billing' && (
        <PortalBillingTab
          setActiveInvoiceId={setActiveInvoiceId}
          setDrawerOpen={setDrawerOpen}
        />
      )}

      {/* ── Detail modals (read-only) ── */}
      {activeTask && <TaskDetailModal task={activeTask} onClose={() => setActiveTask(null)} />}
      {activeTodo && <TodoDetailModal todo={activeTodo} onClose={() => setActiveTodo(null)} />}
      {activeInvoiceId && (
        <PortalInvoiceDrawer
          invoiceId={activeInvoiceId}
          open={drawerOpen}
          onClose={() => { setDrawerOpen(false); setActiveInvoiceId(null); }}
        />
      )}
    </Page>
  );
}
