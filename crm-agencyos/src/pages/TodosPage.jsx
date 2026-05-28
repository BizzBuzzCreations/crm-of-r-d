import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Trash2, Check, MoreHorizontal, Search, Calendar, X, ClipboardList, Briefcase, Clock } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/shallow';
import {
  Page, Button, PriorityBadge, Avatar, Modal, Input, Select,
  Textarea, EmptyState, ConfirmDialog, DropdownMenu,
} from '../components/ui';
import { cn, PRIORITY_CONFIG, canManage, truncate, getId, sameId } from '../utils/helpers';

const MEMBER_STATUSES = [
  { id: 'pending',           label: 'Pending',      color: '#f59e0b', bg: '#fffbeb' },
  { id: 'in-progress',       label: 'In Progress',  color: '#3b82f6', bg: '#eff6ff' },
  { id: 'sent-for-approval', label: 'For Approval', color: '#8b5cf6', bg: '#f5f3ff' },
];
const ALL_STATUSES = [
  ...MEMBER_STATUSES,
  { id: 'completed', label: 'Completed', color: '#10b981', bg: '#ecfdf5' },
];

// ── Date filter button ─────────────────────────────────────────
function DateFilter({ value, onChange }) {
  return (
    <div className="relative flex items-center">
      <Calendar size={13} className="absolute left-3 text-slate-400 pointer-events-none z-10" />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'form-input pl-9 pr-8 py-1.5 text-[13px] w-[165px] cursor-pointer appearance-none',
          value ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : ''
        )}
        style={{ colorScheme: 'light' }}
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 z-10" title="Clear date">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// ── Today's date string ─────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0];

// ── Format time HH:MM (24h) → 12h ───────────────────────────────
const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
};

// ── Todo Form ───────────────────────────────────────────────────
function TodoFormModal({ open, onClose, currentUser }) {
  const { addTodo } = useAppStore();
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: { priority: 'medium', workType: 'in-house', clientName: '', etaStart: '', etaEnd: '' },
  });
  const priorityVal = watch('priority');
  const workTypeVal = watch('workType');

  const onSubmit = (data) => {
    addTodo({
      ...data,
      userId: getId(currentUser),
      status: 'pending',
      clientName: data.workType === 'client' ? data.clientName : '',
    });
    toast.success('Todo added!');
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Add Daily Todo" size="lg"
      footer={<><Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button><Button variant="primary" onClick={handleSubmit(onSubmit)}><Plus size={14} /> Add Todo</Button></>}
    >
      <div className="px-6 py-5 space-y-4">
        <Input label="Todo Title *" placeholder="What needs to be done today?" error={errors.title?.message}
          {...register('title', { required: 'Title is required' })} />

        <Textarea label="Description" placeholder="Additional details or steps..." rows={3} {...register('description')} />

        {/* Self-assign read-only */}
        <div>
          <label className="form-label">Assigned To</label>
          <div className="flex items-center gap-2.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
            <Avatar user={currentUser} size="xs" />
            <span className="text-[13.5px] font-medium text-slate-700 dark:text-slate-300">{currentUser?.name}</span>
            <span className="ml-auto badge badge-neutral text-[10.5px]">You</span>
          </div>
        </div>

        {/* Work Type */}
        <div>
          <label className="form-label">Work Type</label>
          <div className="grid grid-cols-2 gap-3">
            <label className="cursor-pointer">
              <input type="radio" value="in-house" className="sr-only" {...register('workType')} />
              <div className={cn('flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-[13px] font-semibold transition-all',
                workTypeVal === 'in-house' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300'
              )}>
                <Briefcase size={14} /> In-House
              </div>
            </label>
            <label className="cursor-pointer">
              <input type="radio" value="client" className="sr-only" {...register('workType')} />
              <div className={cn('flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-[13px] font-semibold transition-all',
                workTypeVal === 'client' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300'
              )}>
                <Briefcase size={14} /> Client
              </div>
            </label>
          </div>
          {workTypeVal === 'client' && (
            <div className="mt-3">
              <Input placeholder="Enter client name…" error={errors.clientName?.message}
                {...register('clientName', { required: workTypeVal === 'client' ? 'Client name is required' : false })} />
            </div>
          )}
        </div>

        {/* ETA — Start & End Time */}
        <div>
          <label className="form-label flex items-center gap-1.5"><Clock size={13} /> ETA (Estimated Time)</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-slate-500 mb-1 block">Start Time</label>
              <input
                type="time"
                className="form-input text-[13px] py-1.5 w-full"
                style={{ colorScheme: 'light' }}
                {...register('etaStart')}
              />
            </div>
            <div>
              <label className="text-[11.5px] text-slate-500 mb-1 block">End Time</label>
              <input
                type="time"
                className="form-input text-[13px] py-1.5 w-full"
                style={{ colorScheme: 'light' }}
                {...register('etaEnd')}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="form-label">Priority</label>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
              <label key={key} className="cursor-pointer">
                <input type="radio" value={key} className="sr-only" {...register('priority')} />
                <div
                  className={cn('flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border-2 text-[12.5px] font-semibold transition-all',
                    priorityVal === key ? 'border-current' : 'border-slate-200 dark:border-slate-600 text-slate-500'
                  )}
                  style={priorityVal === key ? { background: cfg.bg, color: cfg.color, borderColor: cfg.dot } : {}}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                  {cfg.label}
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Todo Card ──────────────────────────────────────────────────
function TodoCard({ todo, users, role, onMove, onApprove, onDelete }) {
  const owner     = users.find((u) => sameId(u, todo.userId));
  const pCfg      = PRIORITY_CONFIG[todo.priority] || PRIORITY_CONFIG.medium;
  const isManager = canManage(role);
  const cols      = isManager ? ALL_STATUSES : MEMBER_STATUSES;
  const targets   = cols.filter((c) => c.id !== todo.status);

  const menuItems = [
    ...targets.map((c) => ({ label: `Move → ${c.label}`, onClick: () => onMove(getId(todo), { status: c.id }) })),
    ...(targets.length ? [{ separator: true }] : []),
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete(getId(todo)) },
  ];

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      className={cn('kanban-card border-l-[3px]')} style={{ borderLeftColor: pCfg.dot }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200 leading-snug flex-1">{todo.title}</p>
        <DropdownMenu trigger={<button className="btn-icon p-1 text-slate-400 flex-shrink-0"><MoreHorizontal size={14} /></button>} items={menuItems} />
      </div>
      {todo.description && <p className="text-[12px] text-slate-500 leading-relaxed mb-2">{truncate(todo.description, 70)}</p>}
      <div className="flex gap-1.5 flex-wrap mb-2.5">
        <PriorityBadge priority={todo.priority} />
        {todo.workType === 'client' && todo.clientName && (
          <span className="badge text-[10.5px]" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>🏢 {todo.clientName}</span>
        )}
        {todo.workType === 'in-house' && (
          <span className="badge text-[10.5px]" style={{ background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' }}>🏠 In-House</span>
        )}
        {(todo.etaStart || todo.etaEnd) && (
          <span className="badge badge-neutral text-[10.5px] inline-flex items-center gap-1">
            <Clock size={9} />
            {todo.etaStart && todo.etaEnd
              ? `${fmtTime(todo.etaStart)} → ${fmtTime(todo.etaEnd)}`
              : fmtTime(todo.etaStart || todo.etaEnd)}
          </span>
        )}
        {!todo.etaStart && !todo.etaEnd && todo.eta && (
          <span className="badge badge-neutral text-[10.5px]">⏱ {todo.eta}</span>
        )}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-1.5">
          <Avatar user={owner} size="xs" />
          <span className="text-[11.5px] text-slate-500">{owner?.name?.split(' ')[0]}</span>
        </div>
        {(todo.createdAt?.split?.('T')?.[0] || todo.createdAt) && (
          <span className="text-[10.5px] text-slate-400 flex items-center gap-1">
            <Calendar size={9} /> {todo.createdAt?.split?.('T')?.[0] || todo.createdAt}
          </span>
        )}
      </div>
      {isManager && todo.status === 'sent-for-approval' && (
        <button onClick={() => onApprove(getId(todo))} className="btn-success btn-sm w-full justify-center mt-2.5">
          <Check size={12} /> Approve & Mark Done
        </button>
      )}
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function TodosPage() {
  const { authUser, todos, addTodo, updateTodo, deleteTodo } = useAppStore(useShallow((s) => ({
    authUser:   s.authUser,
    todos:      s.todos,
    addTodo:    s.addTodo,
    updateTodo: s.updateTodo,
    deleteTodo: s.deleteTodo,
  })));
  const users = useAppStore((s) => s.users);

  const [showCreate,       setShowCreate]       = useState(false);
  const [confirmDel,       setConfirmDel]       = useState(null);
  const [showClientFilter, setShowClientFilter] = useState(false);
  const [filters,          setFilters]          = useState({
    search:     '',
    priority:   '',
    status:     '',
    memberId:   '',
    date:       '',
    workType:   '',
    clientName: '',
  });

  const role      = authUser?.role;
  const isManager = canManage(role);

  // Base: members see only their own
  const baseTodos = role === 'member'
    ? todos.filter((t) => sameId(t.userId, authUser))
    : todos;

  // All unique client names from todos (for filter dropdown)
  const allClientNames = [...new Set(
    baseTodos.filter((t) => t.workType === 'client' && t.clientName).map((t) => t.clientName.trim())
  )].sort();

  // Apply filters
  const filtered = baseTodos.filter((t) => {
    if (filters.search   && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.status   && t.status   !== filters.status)   return false;
    if (filters.memberId && isManager && getId(t.userId) !== filters.memberId) return false;
    if (filters.date) {
      const todoDate = t.createdAt?.split?.('T')?.[0] || t.createdAt;
      if (todoDate !== filters.date) return false;
    }
    if (filters.workType === 'in-house' && t.workType !== 'in-house') return false;
    if (filters.workType === 'client') {
      if (t.workType !== 'client') return false;
      if (filters.clientName && t.clientName?.trim() !== filters.clientName) return false;
    }
    return true;
  });

  const handleApprove = (id) => { updateTodo(id, { status: 'completed' }); toast.success('Todo approved & completed!'); };
  const handleDelete  = (id) => { deleteTodo(id); toast.success('Todo deleted.'); };

  const memberUsers          = users.filter((u) => u.role === 'member');
  const statusFilterOptions  = isManager ? ALL_STATUSES : MEMBER_STATUSES;
  const cols                 = ALL_STATUSES;
  const activeFiltersCount   = [filters.search, filters.priority, filters.status, filters.memberId, filters.date, filters.workType].filter(Boolean).length;

  const allDates = [...new Set(baseTodos.map((t) => t.createdAt?.split?.('T')?.[0]||t.createdAt).filter(Boolean))].sort().reverse();

  const fmtDate = (ds) => ds ? new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';

  const isViewingToday = !filters.date || filters.date === todayStr();
  const isViewingPast  = filters.date && filters.date < todayStr();

  const workFilterLabel = filters.workType === 'in-house' ? '🏠 In-House'
    : filters.workType === 'client' && filters.clientName ? `🏢 ${filters.clientName}`
    : filters.workType === 'client' ? '🏢 All Clients'
    : 'Work Type';

  return (
    <Page>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">Daily Todos</h1>
          <p className="page-sub">
            {filtered.filter((t) => t.status === 'completed').length} of {filtered.length} completed
            {filters.date
              ? <span className="ml-2 text-primary-500 font-medium inline-flex items-center gap-1">
                  · {isViewingPast ? <><Calendar size={13} className="text-primary-500" /> History:</> : <ClipboardList size={13} className="text-primary-500" />}
                  {new Date(filters.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              : <span className="ml-2 text-slate-400">· All history</span>
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Today button */}
          <button
            className={cn('btn-outline btn-sm', isViewingToday && !filters.date ? 'bg-primary-50 border-primary-300 text-primary-600 dark:bg-primary-900/20' : '')}
            onClick={() => setFilters((f) => ({ ...f, date: todayStr() }))}
          >
            Today
          </button>

          {/* Work Type / Client filter — right next to Today */}
          <div className="relative">
            <button
              onClick={() => setShowClientFilter((v) => !v)}
              className={cn('btn-outline btn-sm flex items-center gap-1.5 transition-all',
                filters.workType ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-600' : ''
              )}
            >
              <Briefcase size={13} />
              <span>{workFilterLabel}</span>
              {filters.workType && (
                <span onClick={(e) => { e.stopPropagation(); setFilters((f) => ({ ...f, workType: '', clientName: '' })); }} className="ml-1 hover:text-red-500">
                  <X size={11} />
                </span>
              )}
            </button>

            <AnimatePresence>
              {showClientFilter && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowClientFilter(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-1.5 z-20 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Filter by Work Type</p>
                    </div>
                    <button onClick={() => { setFilters((f) => ({ ...f, workType: '', clientName: '' })); setShowClientFilter(false); }}
                      className={cn('flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50',
                        !filters.workType ? 'text-primary-600 font-semibold' : 'text-slate-700 dark:text-slate-300')}>
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[11px]">✦</span>
                      All Work Types
                    </button>
                    <button onClick={() => { setFilters((f) => ({ ...f, workType: 'in-house', clientName: '' })); setShowClientFilter(false); }}
                      className={cn('flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50',
                        filters.workType === 'in-house' ? 'text-indigo-600 font-semibold bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-700 dark:text-slate-300')}>
                      <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-[11px]">🏠</span>
                      In-House
                    </button>
                    <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-700 mt-0.5">
                      <p className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400 mb-1">Clients</p>
                    </div>
                    <button onClick={() => { setFilters((f) => ({ ...f, workType: 'client', clientName: '' })); setShowClientFilter(false); }}
                      className={cn('flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50',
                        filters.workType === 'client' && !filters.clientName ? 'text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-900/20' : 'text-slate-700 dark:text-slate-300')}>
                      <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-[11px]">🏢</span>
                      All Clients
                    </button>
                    {allClientNames.length > 0 ? allClientNames.map((cn_) => (
                      <button key={cn_} onClick={() => { setFilters((f) => ({ ...f, workType: 'client', clientName: cn_ })); setShowClientFilter(false); }}
                        className={cn('flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50',
                          filters.clientName === cn_ ? 'text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-900/20' : 'text-slate-700 dark:text-slate-300')}>
                        <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-[10px] font-bold text-emerald-600">{cn_[0]?.toUpperCase()}</span>
                        {cn_}
                      </button>
                    )) : <p className="px-3 py-2 text-[12px] text-slate-400 italic">No clients yet</p>}
                    <div className="h-1.5" />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Add Todo
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-2.5 mb-5 flex-wrap items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input className="form-input pl-9 py-1.5 text-[13px]" placeholder="Search todos…"
            value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        </div>

        <select className="form-input w-[155px] text-[13px] py-1.5" value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All Statuses</option>
          {statusFilterOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        {isManager && (
          <select className="form-input w-[155px] text-[13px] py-1.5" value={filters.memberId}
            onChange={(e) => setFilters((f) => ({ ...f, memberId: e.target.value }))}>
            <option value="">All Members</option>
            {memberUsers.map((u) => <option key={getId(u)} value={getId(u)}>{u.name.split(' ')[0]}</option>)}
          </select>
        )}

        <select className="form-input w-[150px] text-[13px] py-1.5" value={filters.priority}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
          <option value="">All Priorities</option>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <DateFilter value={filters.date} onChange={(v) => setFilters((f) => ({ ...f, date: v }))} />

        {activeFiltersCount > 0 && (
          <button
            className="flex items-center gap-1 text-[12.5px] text-primary-500 hover:text-primary-600 font-medium"
            onClick={() => setFilters({ search: '', priority: '', status: '', memberId: '', date: '', workType: '', clientName: '' })}
          >
            <X size={12} /> Clear {activeFiltersCount > 1 ? `(${activeFiltersCount})` : ''}
          </button>
        )}
      </div>

      {/* Date context banner */}
      {filters.date && (
        <div className={cn(
          'flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl border text-[13px]',
          isViewingPast
            ? 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
            : 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
        )}>
          <Calendar size={14} />
          {isViewingPast
            ? <span>Viewing history for <strong>{fmtDate(filters.date)}</strong></span>
            : <span>Viewing todos for <strong>{fmtDate(filters.date)}</strong></span>
          }
          <span className="text-slate-400 mx-1">·</span>
          <span className="text-slate-500">{filtered.length} todo{filtered.length !== 1 ? 's' : ''}</span>
          {isViewingPast && (
            <>
              <span className="text-slate-300 mx-1">·</span>
              <span className="text-[12px] opacity-70">Completed: {filtered.filter((t) => t.status === 'completed').length}</span>
            </>
          )}
          <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => setFilters((f) => ({ ...f, date: '' }))}><X size={14} /></button>
        </div>
      )}

      {/* Work type active banner */}
      {filters.workType && (
        <div className={cn('flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl border text-[13px]',
          filters.workType === 'in-house'
            ? 'bg-indigo-50 dark:bg-indigo-900/15 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
            : 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300')}>
          <Briefcase size={14} />
          {filters.workType === 'in-house' ? <span>🏠 Showing <strong>In-House</strong> todos only</span>
            : filters.clientName ? <span>🏢 Showing todos for client: <strong>{filters.clientName}</strong></span>
            : <span>🏢 Showing <strong>all client</strong> todos</span>}
          <span className="text-slate-400 mx-1">·</span>
          <span>{filtered.length} todo{filtered.length !== 1 ? 's' : ''}</span>
          <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => setFilters((f) => ({ ...f, workType: '', clientName: '' }))}><X size={14} /></button>
        </div>
      )}

      {/* Date history chips */}
      {!filters.date && allDates.length > 1 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-[11.5px] font-semibold text-slate-400 uppercase tracking-wide">Quick jump:</span>
          {allDates.slice(0, 7).map((d) => (
            <button
              key={d}
              onClick={() => setFilters((f) => ({ ...f, date: d }))}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11.5px] font-medium border transition-all',
                d === todayStr()
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-primary-400 hover:text-primary-600'
              )}
            >
              {d === todayStr() ? 'Today' : new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              <span className="ml-1 text-[10px] opacity-60">
                ({baseTodos.filter((t) => (t.createdAt?.split?.('T')?.[0] || t.createdAt) === d).length})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Kanban board ── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={filters.date ? `No todos for ${fmtDate(filters.date)}` : 'No todos yet'}
          description={filters.date
            ? isViewingPast ? 'No todos were recorded on this date.' : 'Add your first todo for today!'
            : 'Add your first todo using the button above.'
          }
          action={isViewingToday && (
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> Add Todo
            </Button>
          )}
        />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cols.map((col) => {
            const colItems = filtered.filter((t) => t.status === col.id);
            return (
              <div key={col.id}>
                <div className="flex items-center justify-between px-3 py-2.5 card mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">{col.label}</span>
                  </div>
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: col.bg, color: col.color }}>{colItems.length}</span>
                </div>
                <div className="space-y-2.5">
                  <AnimatePresence>
                    {colItems.map((todo) => (
                      <TodoCard key={getId(todo)} todo={todo} users={users} role={role}
                        onMove={(id, updates) => updateTodo(id, updates)}
                        onApprove={handleApprove}
                        onDelete={(id) => setConfirmDel(id)}
                      />
                    ))}
                  </AnimatePresence>
                  {colItems.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl py-7 text-center text-[11.5px] text-slate-400">Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TodoFormModal open={showCreate} onClose={() => setShowCreate(false)} currentUser={authUser} />
      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => handleDelete(confirmDel)} title="Delete Todo" message="Remove this todo permanently?" confirmLabel="Delete" />
    </Page>
  );
}
