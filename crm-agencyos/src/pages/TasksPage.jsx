import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Plus, Columns, List, Table, Search, MoreHorizontal,
  Trash2, Check, Calendar, Clock, Building2, X,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/shallow';
import {
  Page, Button, Badge, PriorityBadge, StatusBadge, Avatar,
  Modal, Input, Select, Textarea, ViewToggle, EmptyState,
  ProgressBar, ConfirmDialog, DropdownMenu,
} from '../components/ui';
import { cn, PRIORITY_CONFIG, canManage, truncate } from '../utils/helpers';

const KANBAN_COLS = [
  { id: 'pending',           label: 'Pending',      color: '#f59e0b', bg: '#fffbeb' },
  { id: 'in-progress',       label: 'In Progress',  color: '#3b82f6', bg: '#eff6ff' },
  { id: 'sent-for-approval', label: 'For Approval', color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'completed',         label: 'Completed',    color: '#10b981', bg: '#ecfdf5' },
];

const MEMBER_MOVE_TARGETS = ['pending', 'in-progress', 'sent-for-approval'];

// ── Date filter button ────────────────────────────────────────
function DateFilter({ value, onChange, label = 'All Dates' }) {
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
        <button
          onClick={() => onChange('')}
          className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 z-10"
          title="Clear date filter"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// ── Task Form ─────────────────────────────────────────────────
function TaskFormModal({ open, onClose, users, clients, currentUser }) {
  const { addTask } = useAppStore();
  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm({
    defaultValues: { priority: 'medium', type: 'inhouse', assignedTo: '', clientId: '' },
  });
  const taskType    = watch('type');
  const priorityVal = watch('priority');
  const memberUsers = users.filter((u) => u.role === 'member');

  const onSubmit = (data) => {
    addTask({
      ...data,
      assignedTo: parseInt(data.assignedTo) || currentUser.id,
      clientId:   data.clientId ? parseInt(data.clientId) : null,
      assignedBy: currentUser.id,
      status:     'pending',
      progress:   0,
      tags:       data.tags ? data.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
    });
    toast.success('Task created!');
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Create New Task"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)}>
            <Plus size={14} /> Create Task
          </Button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <Input label="Task Title *" placeholder="Clear, descriptive task title" error={errors.title?.message} {...register('title', { required: 'Title is required' })} />
        <Textarea label="Description" placeholder="Describe the task in detail..." rows={3} {...register('description')} />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Assign To" error={errors.assignedTo?.message} {...register('assignedTo', { required: 'Please assign this task' })}>
            <option value="">Select member…</option>
            {memberUsers.map((u) => <option key={getId(u)} value={getId(u)}>{u.name} — {u.position}</option>)}
          </Select>
          <div>
            <label className="form-label">Task Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[['inhouse','In-House'],['client','Client']].map(([v, l]) => (
                <button key={v} type="button"
                  onClick={() => { setValue('type', v); setValue('clientId', ''); }}
                  className={cn('px-3 py-2 rounded-lg border-2 text-[13px] font-medium transition-all',
                    taskType === v
                      ? 'border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                      : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  )}
                >{l}</button>
              ))}
            </div>
          </div>
        </div>

        {taskType === 'client' && (
          <Select label="Client" {...register('clientId', { required: taskType === 'client' })}>
            <option value="">Select client…</option>
            {clients.map((c) => <option key={getId(c)} value={getId(c)}>{c.name}</option>)}
          </Select>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input label="Due Date" type="date" {...register('dueDate')} />
          <Input label="ETA" placeholder="e.g. 8h, 2d" {...register('eta')} />
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
        <Input label="Tags (comma-separated)" placeholder="design, web, client" {...register('tags')} />
      </div>
    </Modal>
  );
}

// ── Kanban Card ───────────────────────────────────────────────
function KanbanCard({ task, users, clients, role, onMove, onApprove, onDelete }) {
  const assignee  = users.find((u) => sameId(u, task.assignedTo));
  const client    = task.clientId ? clients.find((c) => sameId(c, task.clientId)) : null;
  const pCfg      = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const isManager = canManage(role);

  const targets = KANBAN_COLS
    .filter((c) => c.id !== task.status)
    .filter((c) => isManager || MEMBER_MOVE_TARGETS.includes(c.id));

  const menuItems = [
    ...targets.map((c) => ({ label: `Move → ${c.label}`, onClick: () => onMove(task.id, c.id) })),
    ...(targets.length ? [{ separator: true }] : []),
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete(task.id) },
  ];

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      className={cn('kanban-card border-l-[3px]')} style={{ borderLeftColor: pCfg.dot }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200 leading-snug flex-1">{task.title}</p>
        <DropdownMenu trigger={<button className="btn-icon p-1 text-slate-400 flex-shrink-0"><MoreHorizontal size={14} /></button>} items={menuItems} />
      </div>
      {client && <div className="flex items-center gap-1 text-[11.5px] text-slate-500 mb-2"><Building2 size={11} /> {client.name}</div>}
      {task.description && <p className="text-[12px] text-slate-500 leading-relaxed mb-2.5">{truncate(task.description, 80)}</p>}
      {task.progress > 0 && (
        <div className="mb-2.5">
          <div className="flex justify-between text-[11px] text-slate-400 mb-1"><span>Progress</span><span>{task.progress}%</span></div>
          <ProgressBar value={task.progress} height={4} />
        </div>
      )}
      {task.tags?.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-2.5">
          {task.tags.map((t) => <span key={t} className="badge badge-neutral text-[10px]">{t}</span>)}
        </div>
      )}
      <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
          {task.dueDate && <span className="text-[11px] text-slate-400 flex items-center gap-0.5"><Calendar size={10} />{task.dueDate}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {task.eta && <span className="text-[11px] text-slate-400"><Clock size={10} className="inline mr-0.5" />{task.eta}</span>}
          <Avatar user={assignee} size="xs" />
        </div>
      </div>
      {isManager && task.status === 'sent-for-approval' && (
        <button onClick={() => onApprove(task.id)} className="btn-success btn-sm w-full justify-center mt-2.5">
          <Check size={12} /> Approve & Mark Done
        </button>
      )}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function TasksPage() {
  const { authUser, tasks, clients, moveTask, deleteTask } = useAppStore(useShallow((s) => ({
    authUser:   s.authUser,
    tasks:      s.tasks,
    clients:    s.clients,
    moveTask:   s.moveTask,
    deleteTask: s.deleteTask,
  })));
  const users = useAppStore((s) => s.users);

  const [view,       setView]       = useState('kanban');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [filters,    setFilters]    = useState({ search: '', priority: '', status: '', memberId: '', date: '' });

  const role      = authUser?.role;
  const isManager = canManage(role);

  // Base: members see only their own tasks
  const baseTasks = role === 'member'
    ? tasks.filter((t) => sameId(t.assignedTo, authUser))
    : tasks;

  // Apply all filters
  const filtered = baseTasks.filter((t) => {
    if (filters.search   && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.status   && t.status   !== filters.status)   return false;
    if (filters.memberId && isManager && getId(t.assignedTo) !== filters.memberId) return false;
    // Date filter: matches dueDate OR createdAt
    if (filters.date) {
      const matchDue     = t.dueDate    === filters.date;
      const matchCreated = t.createdAt?.split?.('T')?.[0] || t.createdAt  === filters.date;
      if (!matchDue && !matchCreated) return false;
    }
    return true;
  });

  const handleApprove = (id) => { moveTask(id, 'completed'); toast.success('Task approved & completed!'); };
  const handleDelete  = (id) => { deleteTask(id); toast.success('Task deleted.'); };

  const statusOptions = isManager
    ? [['pending','Pending'],['in-progress','In Progress'],['sent-for-approval','For Approval'],['completed','Completed']]
    : [['pending','Pending'],['in-progress','In Progress'],['sent-for-approval','For Approval']];

  const memberUsers = users.filter((u) => u.role === 'member');
  const activeFiltersCount = [filters.search, filters.priority, filters.status, filters.memberId, filters.date].filter(Boolean).length;

  return (
    <Page>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">Task Management</h1>
          <p className="page-sub">
            {filtered.length} tasks · {filtered.filter((t) => t.status === 'completed').length} completed
            {filters.date && <span className="ml-2 text-primary-500 font-medium">· Filtered: {new Date(filters.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle
            views={[
              { value: 'kanban', icon: Columns, label: 'Kanban' },
              { value: 'list',   icon: List,    label: 'List'   },
              { value: 'table',  icon: Table,   label: 'Table'  },
            ]}
            active={view} onChange={setView}
          />
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Task
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-2.5 mb-5 flex-wrap items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input className="form-input pl-9 py-1.5 text-[13px]" placeholder="Search tasks…"
            value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        </div>

        {/* All Statuses */}
        <select className="form-input w-[155px] text-[13px] py-1.5" value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All Statuses</option>
          {statusOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        {/* All Members — admin/manager only */}
        {isManager && (
          <select className="form-input w-[155px] text-[13px] py-1.5" value={filters.memberId}
            onChange={(e) => setFilters((f) => ({ ...f, memberId: e.target.value }))}>
            <option value="">All Members</option>
            {memberUsers.map((u) => <option key={getId(u)} value={getId(u)}>{u.name.split(' ')[0]}</option>)}
          </select>
        )}

        {/* All Priorities */}
        <select className="form-input w-[150px] text-[13px] py-1.5" value={filters.priority}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
          <option value="">All Priorities</option>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* ── Date Filter — next to All Priorities ── */}
        <DateFilter
          value={filters.date}
          onChange={(v) => setFilters((f) => ({ ...f, date: v }))}
        />

        {/* Clear all */}
        {activeFiltersCount > 0 && (
          <button
            className="flex items-center gap-1 text-[12.5px] text-primary-500 hover:text-primary-600 font-medium"
            onClick={() => setFilters({ search: '', priority: '', status: '', memberId: '', date: '' })}
          >
            <X size={12} /> Clear {activeFiltersCount > 1 ? `(${activeFiltersCount})` : ''}
          </button>
        )}
      </div>

      {/* Date filter active banner */}
      {filters.date && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl text-[13px] text-primary-700 dark:text-primary-300">
          <Calendar size={14} />
          Showing tasks for <strong>{new Date(filters.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">{filtered.length} task{filtered.length !== 1 ? 's' : ''} found</span>
          <button className="ml-auto text-primary-500 hover:text-primary-700" onClick={() => setFilters((f) => ({ ...f, date: '' }))}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Kanban ── */}
      {view === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="kanban-col flex-shrink-0">
                <div className="flex items-center justify-between px-3 py-2.5 card mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                    <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">{col.label}</span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: col.bg, color: col.color }}>{colTasks.length}</span>
                </div>
                <div className="space-y-2.5">
                  <AnimatePresence>
                    {colTasks.map((task) => (
                      <KanbanCard key={getId(task)} task={task} users={users} clients={clients} role={role}
                        onMove={moveTask} onApprove={handleApprove} onDelete={(id) => setConfirmDel(id)} />
                    ))}
                  </AnimatePresence>
                  {colTasks.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl py-8 text-center text-[12px] text-slate-400">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── List ── */}
      {view === 'list' && (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((task) => {
              const assignee = users.find((u) => sameId(u, task.assignedTo));
              const client   = task.clientId ? clients.find((c) => sameId(c, task.clientId)) : null;
              const pCfg     = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
              return (
                <motion.div key={getId(task)} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className={cn('card p-4 flex items-center gap-4 border-l-[3px]')} style={{ borderLeftColor: pCfg.dot }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {client && <span className="text-[11.5px] text-slate-500 flex items-center gap-1"><Building2 size={10} /> {client.name}</span>}
                      {task.dueDate && <span className="text-[11.5px] text-slate-400 flex items-center gap-1"><Calendar size={10} /> {task.dueDate}</span>}
                      <span className="text-[11px] text-slate-400">Created: {task.createdAt?.split?.('T')?.[0] || task.createdAt}</span>
                    </div>
                  </div>
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Avatar user={assignee} size="xs" />
                    <span className="text-[12px] text-slate-600 dark:text-slate-400 hidden lg:block">{assignee?.name?.split(' ')[0]}</span>
                  </div>
                  {task.progress > 0 && (
                    <div className="w-20 flex-shrink-0">
                      <ProgressBar value={task.progress} height={5} />
                      <p className="text-[10px] text-slate-400 mt-0.5 text-right">{task.progress}%</p>
                    </div>
                  )}
                  {isManager && task.status === 'sent-for-approval' && (
                    <Button variant="success" size="xs" onClick={() => handleApprove(task.id)}><Check size={11} /> Approve</Button>
                  )}
                  <button className="btn-icon text-slate-400 hover:text-red-500 p-1" onClick={() => setConfirmDel(task.id)}>
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && (
            <EmptyState icon={Calendar} title="No tasks found"
              description={filters.date ? `No tasks for ${filters.date}` : 'Adjust filters or create a new task.'}
              action={!filters.date && <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}><Plus size={13} /> Create Task</Button>}
            />
          )}
        </div>
      )}

      {/* ── Table ── */}
      {view === 'table' && (
        <div className="table-container">
          <table className="crm-table">
            <thead>
              <tr>{['Task','Client','Assigned To','Priority','Status','Due Date','Created','Progress','Actions'].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((task) => {
                const assignee = users.find((u) => sameId(u, task.assignedTo));
                const client   = task.clientId ? clients.find((c) => sameId(c, task.clientId)) : null;
                return (
                  <tr key={getId(task)}>
                    <td className="font-semibold max-w-[200px] truncate">{task.title}</td>
                    <td>{client ? <Badge variant="neutral">{client.name}</Badge> : <span className="text-slate-400 text-[12px]">In-house</span>}</td>
                    <td><div className="flex items-center gap-2"><Avatar user={assignee} size="xs" /><span className="text-[13px]">{assignee?.name?.split(' ')[0]}</span></div></td>
                    <td><PriorityBadge priority={task.priority} /></td>
                    <td><StatusBadge status={task.status} /></td>
                    <td className="text-slate-500 text-[12px]">{task.dueDate || '—'}</td>
                    <td className="text-slate-500 text-[12px]">{task.createdAt?.split?.('T')?.[0] || task.createdAt || '—'}</td>
                    <td>{task.progress > 0 ? <div className="flex items-center gap-2 min-w-[80px]"><ProgressBar value={task.progress} height={5} className="flex-1" /><span className="text-[11px] text-slate-500">{task.progress}%</span></div> : <span className="text-slate-400 text-[12px]">—</span>}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {isManager && task.status === 'sent-for-approval' && <Button variant="success" size="xs" onClick={() => handleApprove(task.id)}><Check size={11} /></Button>}
                        <button className="btn-icon text-slate-400 hover:text-red-500 p-1" onClick={() => setConfirmDel(task.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={Calendar} title="No tasks found" description={filters.date ? `No tasks for ${filters.date}` : 'Adjust filters or create a task.'} />}
        </div>
      )}

      <TaskFormModal open={showCreate} onClose={() => setShowCreate(false)} users={users} clients={clients} currentUser={authUser} />
      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => handleDelete(confirmDel)} title="Delete Task" message="This task will be permanently deleted." confirmLabel="Delete" />
    </Page>
  );
}