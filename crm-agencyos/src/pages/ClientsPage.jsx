import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Plus, Search, Grid, List, ArrowLeft, Building2, Mail, Phone,
  Globe, Calendar, Users, FileText, ChevronLeft, ChevronRight,
  CheckSquare, ListTodo, Clock, TrendingUp,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/shallow';
import {
  Page, Button, Badge, Avatar, AvatarGroup, StatusBadge,
  ViewToggle, EmptyState, Input, Textarea, Select, Modal, ProgressBar,
  PriorityBadge, ConfirmDialog,
} from '../components/ui';
import { cn, getId, sameId, CLIENT_STATUS_CONFIG, PAYMENT_CONFIG, canManage } from '../utils/helpers';

// ── Calendar helpers ──────────────────────────────────────────
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_MON_FIRST = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; // Mon-first like screenshot

// Build calendar grid (Mon-first)
function buildMonthGrid(year, month) {
  const firstDate = new Date(year, month, 1);
  const lastDate  = new Date(year, month + 1, 0);
  // Mon=0 offset
  let startDow = firstDate.getDay() - 1; // 0=Mon … 6=Sun
  if (startDow < 0) startDow = 6;       // Sunday -> index 6

  const grid = [];
  // leading nulls from prev month
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, -(startDow - i - 1));
    grid.push({ date: d, current: false });
  }
  for (let d = 1; d <= lastDate.getDate(); d++) {
    grid.push({ date: new Date(year, month, d), current: true });
  }
  // trailing nulls
  const rem = 42 - grid.length;
  for (let i = 1; i <= rem; i++) {
    grid.push({ date: new Date(year, month + 1, i), current: false });
  }
  return grid;
}

function ds(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// ── Client Calendar Component ─────────────────────────────────
function ClientCalendar({ client, tasks, todos, users }) {
  const today     = new Date();
  const todayStr  = ds(today);

  const [year,     setYear]     = useState(today.getFullYear());
  const [month,    setMonth]    = useState(today.getMonth());
  const [selected, setSelected] = useState(todayStr); // default to today

  // Tasks for THIS client only, by dueDate
  const clientTasks = useMemo(
    () => tasks.filter((t) => sameId(t.clientId, client) && t.dueDate),
    [tasks, client]
  );

  // Todos from team members assigned to this client, by createdAt
  const clientTodos = useMemo(
    () => todos.filter((t) => client.assignedTeam?.some((tm) => sameId(tm, t.userId)) && t.createdAt),
    [todos, client]
  );

  // Build lookup: date -> { tasks[], todos[] }
  const eventMap = useMemo(() => {
    const map = {};
    clientTasks.forEach((t) => {
      if (!map[t.dueDate]) map[t.dueDate] = { tasks: [], todos: [] };
      map[t.dueDate].tasks.push(t);
    });
    clientTodos.forEach((t) => {
      if (!map[t.createdAt]) map[t.createdAt] = { tasks: [], todos: [] };
      map[t.createdAt].todos.push(t);
    });
    return map;
  }, [clientTasks, clientTodos]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };
  const goToday   = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(todayStr); };

  // Selected day data
  const selData   = selected ? (eventMap[selected] || { tasks: [], todos: [] }) : null;
  const selDate   = selected ? new Date(selected + 'T00:00:00') : null;

  // Month summary stats
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
  const monthTaskCount = clientTasks.filter(t => t.dueDate?.startsWith(monthStr)).length;
  const monthTodoCount = clientTodos.filter(t => t.createdAt?.startsWith(monthStr)).length;
  const completedCount = clientTasks.filter(t => t.dueDate?.startsWith(monthStr) && t.status === 'completed').length;

  return (
    <div className="card overflow-hidden">
      {/* ── Calendar header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Calendar size={15} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">Client Work Calendar</h3>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">Tasks &amp; team todos for {client.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Month stats */}
          <div className="hidden lg:flex items-center gap-3 text-[12px] mr-2">
            <span className="flex items-center gap-1 text-indigo-600 font-medium"><CheckSquare size={12} /> {monthTaskCount} tasks</span>
            <span className="flex items-center gap-1 text-emerald-600 font-medium"><ListTodo size={12} /> {monthTodoCount} todos</span>
            {completedCount > 0 && <span className="flex items-center gap-1 text-slate-500"><TrendingUp size={12} /> {completedCount} done</span>}
          </div>
          <button onClick={prevMonth} className="btn-icon w-8 h-8"><ChevronLeft size={16} /></button>
          <span className="text-[14px] font-bold text-slate-800 dark:text-slate-200 min-w-[110px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="btn-icon w-8 h-8"><ChevronRight size={16} /></button>
          <button onClick={goToday} className="btn-outline btn-sm ml-1">Today</button>
        </div>
      </div>

      <div className="flex">
        {/* ── Left: Month grid ── */}
        <div className="flex-1 min-w-0 border-r border-slate-200 dark:border-slate-700">
          {/* Day-of-week headers (Mon first) */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
            {DOW_MON_FIRST.map((d) => (
              <div key={d} className="py-2.5 text-center text-[11.5px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                {d}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7">
            {grid.map(({ date, current }, i) => {
              const dateStr  = ds(date);
              const events   = eventMap[dateStr];
              const isToday  = dateStr === todayStr;
              const isSel    = dateStr === selected;
              const tCount   = events?.tasks.length || 0;
              const dCount   = events?.todos.length || 0;
              const hasEvents = tCount > 0 || dCount > 0;
              const lastCol  = i % 7 === 6;

              return (
                <div
                  key={i}
                  onClick={() => setSelected(dateStr)}
                  className={cn(
                    'border-b border-r border-slate-100 dark:border-slate-800 cursor-pointer transition-colors',
                    !current   && 'bg-slate-50/60 dark:bg-slate-900/40',
                    isSel      && 'bg-indigo-50 dark:bg-indigo-900/20',
                    !isSel && current && 'hover:bg-slate-100 dark:hover:bg-slate-800/40',
                    lastCol    && 'border-r-0',
                  )}
                  style={{ minHeight: 90 }}
                >
                  {/* Date number */}
                  <div className="flex items-start justify-between p-2">
                    <span className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold transition-colors',
                      isToday ? 'bg-indigo-600 text-white' : isSel ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : current ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600',
                    )}>
                      {date.getDate()}
                    </span>
                  </div>

                  {/* Event pills */}
                  {hasEvents && (
                    <div className="px-2 pb-2 space-y-[3px]">
                      {events?.tasks.slice(0, 2).map((t) => (
                        <div key={t.id}
                          className="text-[10px] font-medium px-1.5 py-[2px] rounded border-l-[2px] truncate text-indigo-700 dark:text-indigo-300"
                          style={{ background: '#eef2ff', borderLeftColor: '#6366f1' }}
                        >
                          {t.title}
                        </div>
                      ))}
                      {events?.todos.slice(0, tCount >= 2 ? 0 : 2 - tCount).map((t) => (
                        <div key={t.id}
                          className="text-[10px] font-medium px-1.5 py-[2px] rounded border-l-[2px] truncate text-emerald-700 dark:text-emerald-300"
                          style={{ background: '#ecfdf5', borderLeftColor: '#10b981' }}
                        >
                          {t.title}
                        </div>
                      ))}
                      {(tCount + dCount) > 2 && (
                        <div className="text-[9.5px] text-slate-400 pl-1">+{tCount + dCount - 2} more</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
            <div className="flex items-center gap-1.5 text-[11.5px] text-slate-600 dark:text-slate-400">
              <span className="w-3 h-2.5 rounded-sm" style={{ background: '#eef2ff', borderLeft: '2px solid #6366f1', display:'inline-block' }} />
              Tasks
            </div>
            <div className="flex items-center gap-1.5 text-[11.5px] text-slate-600 dark:text-slate-400">
              <span className="w-3 h-2.5 rounded-sm" style={{ background: '#ecfdf5', borderLeft: '2px solid #10b981', display:'inline-block' }} />
              Todos
            </div>
          </div>
        </div>

        {/* ── Right: Day detail panel ── */}
        <div className="w-[320px] flex-shrink-0 flex flex-col overflow-y-auto" style={{ maxHeight: 620 }}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
              <Calendar size={32} className="mb-3 opacity-30" />
              <p className="text-[13.5px] font-semibold">Select a date to see work</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={selected}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="flex-1"
              >
                {/* Panel header */}
                <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-bold text-slate-900 dark:text-white">
                        {selDate?.toLocaleDateString('en-US', { weekday: 'long' })}
                      </p>
                      <p className="text-[12px] text-slate-500">
                        {selDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        {ds(selDate) === todayStr && <span className="ml-2 badge badge-primary text-[10px]">Today</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-bold text-slate-900 dark:text-white leading-none">
                        {(selData?.tasks.length || 0) + (selData?.todos.length || 0)}
                      </div>
                      <div className="text-[10.5px] text-slate-400">items</div>
                    </div>
                  </div>

                  {/* Mini summary */}
                  {((selData?.tasks.length || 0) + (selData?.todos.length || 0)) > 0 && (
                    <div className="flex gap-2 mt-2">
                      {selData.tasks.length > 0 && (
                        <span className="badge badge-primary text-[10.5px]">
                          <CheckSquare size={10} /> {selData.tasks.length} task{selData.tasks.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {selData.todos.length > 0 && (
                        <span className="badge badge-success text-[10.5px]">
                          <ListTodo size={10} /> {selData.todos.length} todo{selData.todos.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Panel body */}
                <div className="p-4 space-y-4">
                  {selData?.tasks.length === 0 && selData?.todos.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-slate-400 text-center">
                      <Calendar size={28} className="mb-2 opacity-30" />
                      <p className="text-[13px] font-medium">No work scheduled</p>
                      <p className="text-[11.5px] mt-0.5 opacity-70">No tasks or todos on this date</p>
                    </div>
                  ) : (
                    <>
                      {/* Tasks section */}
                      {selData?.tasks.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2.5">
                            <CheckSquare size={13} className="text-indigo-500" />
                            <span className="text-[12px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                              Tasks ({selData.tasks.length})
                            </span>
                          </div>
                          <div className="space-y-2">
                            {selData.tasks.map((t) => {
                              const assignee = users.find((u) => sameId(u, t.assignedTo));
                              return (
                                <div key={getId(t)} className="rounded-xl border border-indigo-100 dark:border-indigo-800/40 bg-indigo-50/60 dark:bg-indigo-900/10 p-3">
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">{t.title}</p>
                                    <StatusBadge status={t.status} />
                                  </div>
                                  {t.description && (
                                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed line-clamp-2">{t.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <PriorityBadge priority={t.priority} />
                                    {t.eta && <span className="text-[10.5px] text-slate-400 flex items-center gap-0.5"><Clock size={9} />{t.eta}</span>}
                                    {t.progress > 0 && (
                                      <div className="flex items-center gap-1.5 flex-1 min-w-[80px]">
                                        <ProgressBar value={t.progress} height={4} className="flex-1" />
                                        <span className="text-[10px] text-slate-400">{t.progress}%</span>
                                      </div>
                                    )}
                                  </div>
                                  {assignee && (
                                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-800/30">
                                      <Avatar user={assignee} size="xs" />
                                      <span className="text-[11px] text-slate-500">{assignee.name}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Todos section */}
                      {selData?.todos.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2.5">
                            <ListTodo size={13} className="text-emerald-500" />
                            <span className="text-[12px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              Team Todos ({selData.todos.length})
                            </span>
                          </div>
                          <div className="space-y-2">
                            {selData.todos.map((t) => {
                              const member = users.find((u) => sameId(u, t.userId));
                              return (
                                <div key={getId(t)} className="rounded-xl border border-emerald-100 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-900/10 p-3">
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">{t.title}</p>
                                    <StatusBadge status={t.status} />
                                  </div>
                                  {t.description && (
                                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed line-clamp-2">{t.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <PriorityBadge priority={t.priority} />
                                    {t.eta && <span className="text-[10.5px] text-slate-400 flex items-center gap-0.5"><Clock size={9} />{t.eta}</span>}
                                  </div>
                                  {member && (
                                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-emerald-100 dark:border-emerald-800/30">
                                      <Avatar user={member} size="xs" />
                                      <span className="text-[11px] text-slate-500">{member.name}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Add Client Modal ──────────────────────────────────────────
function AddClientModal({ open, onClose, users, onSave }) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { status: 'active', paymentStatus: 'pending', contractDuration: '12 months' },
  });

  const memberUsers = users.filter((u) => u.role === 'member');

  const onSubmit = (data) => {
    const newClient = {
      ...data,
      assignedTeam:  data.assignedTeam ? [data.assignedTeam] : [],
      services:      data.services ? data.services.split(',').map((s) => s.trim()).filter(Boolean) : [],
      onboardingDate: data.onboardingDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      projectCount:  0,
      notes:         [],
    };
    onSave(newClient);
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Add New Client"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)}>
            <Plus size={14} /> Add Client
          </Button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Company Name *"
            placeholder="e.g. TechCorp Inc."
            error={errors.name?.message}
            {...register('name', { required: 'Company name is required' })}
          />
          <Input
            label="Contact Person *"
            placeholder="e.g. David Mitchell"
            error={errors.contact?.message}
            {...register('contact', { required: 'Contact name is required' })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Email" type="email" placeholder="client@company.com" {...register('email')} />
          <Input label="Phone" placeholder="+1 (555) 000-0000" {...register('phone')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Website" placeholder="www.company.com" {...register('website')} />
          <Select label="Industry" {...register('industry')}>
            <option value="">Select industry…</option>
            {['Technology','Retail','Marketing','Finance','Healthcare','Education','Real Estate','Other'].map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Budget" placeholder="e.g. $10,000" {...register('budget')} />
          <Select label="Contract Duration" {...register('contractDuration')}>
            {['1 month','3 months','6 months','12 months','24 months','Ongoing'].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </div>

        <Input
          label="Services (comma-separated)"
          placeholder="e.g. Web Development, SEO, Social Media"
          {...register('services')}
        />

        <Input label="Office Address" placeholder="123 Main St, City, State" {...register('address')} />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Status" {...register('status')}>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Select label="Payment Status" {...register('paymentStatus')}>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
          </Select>
        </div>

        <Select label="Assign Team Member" {...register('assignedTeam')}>
          <option value="">None (assign later)</option>
          {memberUsers.map((u) => (
            <option key={getId(u)} value={getId(u)}>{u.name} — {u.position}</option>
          ))}
        </Select>
      </div>
    </Modal>
  );
}

// ── Main ClientsPage ──────────────────────────────────────────
export default function ClientsPage() {
  const { authUser, clients, tasks, todos, addClientNote, addClient } = useAppStore(useShallow((s) => ({
    authUser:       s.authUser,
    clients:        s.clients,
    tasks:          s.tasks,
    todos:          s.todos,
    addClientNote:  s.addClientNote,
    addClient:      s.addClient,
  })));
  const users = useAppStore((s) => s.users);

  const [view,     setView]     = useState('grid');
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [showNote,      setShowNote]      = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [noteText, setNoteText] = useState('');
  const role = authUser?.role;

  const filtered = clients.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.contact.toLowerCase().includes(search.toLowerCase())
  );

  const payVariant = (s) => ({ paid: 'success', pending: 'warning', overdue: 'danger' }[s] || 'neutral');

  // ── Client Detail View ────────────────────────────────────────
  if (selected) {
    const client  = clients.find((c) => sameId(c, selected)) || selected;
    const team    = users.filter((u) => client.assignedTeam?.some((tm) => sameId(tm, u)));
    const cTasks  = tasks.filter((t) => sameId(t.clientId, client));
    // Todos from team members assigned to this client
    const cTodos  = todos.filter((t) => client.assignedTeam?.some((tm) => sameId(tm, t.userId)));

    return (
      <Page>
        {/* Back */}
        <button className="btn-outline btn-sm mb-5" onClick={() => setSelected(null)}>
          <ArrowLeft size={13} /> Back to Clients
        </button>

        {/* Hero */}
        <div className="rounded-2xl p-7 mb-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute w-64 h-64 rounded-full bg-indigo-600/15 blur-3xl top-0 right-0" />
          </div>
          <div className="relative flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold mb-1">{client.name}</h1>
              <p className="text-slate-400 text-[14px]">{client.industry} · {client.contact}</p>
              <div className="flex gap-2 mt-3">
                <span className="badge badge-success text-[11px]">{client.status}</span>
                <span className={cn('badge text-[11px]', `badge-${payVariant(client.paymentStatus)}`)}>{client.paymentStatus}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-indigo-300">{client.budget}</div>
              <div className="text-slate-400 text-[12px] mt-0.5">Contract Value</div>
              <div className="text-slate-500 text-[12px] mt-1">{client.contractDuration}</div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="relative flex gap-6 mt-5 pt-5 border-t border-white/10 flex-wrap">
            {[
              { icon: CheckSquare, label: 'Total Tasks',   value: cTasks.length,                                          color: '#818cf8' },
              { icon: CheckSquare, label: 'Completed',     value: cTasks.filter(t => t.status === 'completed').length,    color: '#34d399' },
              { icon: CheckSquare, label: 'In Progress',   value: cTasks.filter(t => t.status === 'in-progress').length,  color: '#fbbf24' },
              { icon: ListTodo,    label: 'Team Todos',    value: cTodos.length,                                          color: '#a78bfa' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label}>
                <div className="text-[22px] font-bold" style={{ color }}>{value}</div>
                <div className="text-[11.5px] text-slate-400">{label}</div>
              </div>
            ))}
          </div>
        </div>


        {/* ── Overview ── */}
        <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Contact info */}
              <div className="card p-5">
                <h3 className="text-[14px] font-semibold text-slate-800 dark:text-slate-200 mb-4">Contact Information</h3>
                {[
                  [Mail,      'Email',      client.email],
                  [Phone,     'Phone',      client.phone],
                  [Globe,     'Website',    client.website],
                  [Building2, 'Industry',   client.industry],
                  [Calendar,  'Onboarding', client.onboardingDate],
                  [FileText,  'Contract',   client.contractDuration],
                ].map(([Icon, label, val]) => (
                  <div key={label} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                    <Icon size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="text-[13px] text-slate-500 min-w-[100px]">{label}</span>
                    <span className="text-[13.5px] font-medium text-slate-800 dark:text-slate-200">{val || '—'}</span>
                  </div>
                ))}
                <div className="mt-4">
                  <p className="text-[13px] text-slate-500 mb-2">Services</p>
                  <div className="flex gap-2 flex-wrap">
                    {client.services.map((s) => <Badge key={s} variant="primary">{s}</Badge>)}
                  </div>
                </div>
              </div>

              {/* Team + Tasks */}
              <div className="space-y-4">
                <div className="card p-5">
                  <h3 className="text-[14px] font-semibold text-slate-800 dark:text-slate-200 mb-3">Assigned Team ({team.length})</h3>
                  <div className="space-y-2.5">
                    {team.map((u) => (
                      <div key={getId(u)} className="flex items-center gap-3">
                        <Avatar user={u} size="md" showStatus />
                        <div>
                          <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">{u.name}</p>
                          <p className="text-[12px] text-slate-500">{u.position}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card p-5">
                  <h3 className="text-[14px] font-semibold text-slate-800 dark:text-slate-200 mb-3">Active Tasks ({cTasks.length})</h3>
                  <div className="space-y-2">
                    {cTasks.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2">
                        <span className="text-[13px] text-slate-700 dark:text-slate-300 truncate flex-1">{t.title}</span>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                    {cTasks.length === 0 && <p className="text-[13px] text-slate-400">No active tasks</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-slate-800 dark:text-slate-200">Notes Timeline</h3>
                {canManage(role) && (
                  <Button variant="primary" size="sm" onClick={() => setShowNote(true)}>
                    <Plus size={13} /> Add Note
                  </Button>
                )}
              </div>
              {client.notes.length === 0 ? (
                <p className="text-[13px] text-slate-400 py-4 text-center">No notes yet.</p>
              ) : (
                <div className="space-y-3">
                  {client.notes.map((n) => (
                    <div key={n.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-semibold text-primary-600">{n.author}</span>
                        <span className="text-[11.5px] text-slate-400">{n.date}</span>
                      </div>
                      <p className="text-[13.5px] text-slate-700 dark:text-slate-300">{n.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          {/* ── Client Work Calendar (always visible at bottom) ── */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-indigo-500" />
              <h2 className="text-[15px] font-bold text-slate-800 dark:text-slate-200">Work Calendar</h2>
              <span className="text-[12px] text-slate-500 dark:text-slate-400">— tasks &amp; todos for this client</span>
            </div>
            <ClientCalendar
              client={client}
              tasks={tasks}
              todos={todos}
              users={users}
            />
          </div>
        </>

        {/* Add Note Modal */}
        <Modal open={showNote} onClose={() => { setShowNote(false); setNoteText(''); }} title="Add Note"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowNote(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => {
                if (!noteText.trim()) return;
                addClientNote(getId(client), noteText);
                setShowNote(false);
                setNoteText('');
                toast.success('Note added!');
              }}>Save Note</Button>
            </>
          }
        >
          <div className="px-6 py-5">
            <Textarea label="Note" placeholder="Write your note here..." value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4} />
          </div>
        </Modal>
      </Page>
    );
  }

  // ── Clients List ──────────────────────────────────────────────
  return (
    <Page>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">Clients &amp; Projects</h1>
          <p className="page-sub">{clients.length} clients · {clients.filter((c) => c.status === 'active').length} active</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle views={[{value:'grid',icon:Grid,label:'Grid'},{value:'list',icon:List,label:'List'}]} active={view} onChange={setView} />
          {canManage(role) && <Button variant="primary" size="sm" onClick={() => setShowAddClient(true)}><Plus size={13} /> Add Client</Button>}
        </div>
      </div>

      <div className="relative max-w-xs mb-5">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input className="form-input pl-9 py-1.5 text-[13px]" placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Grid */}
      {view === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const team   = users.filter((u) => c.assignedTeam?.some((tm) => sameId(tm, u)));
            const cTasks = tasks.filter((t) => sameId(t.clientId, c));
            const done   = cTasks.filter((t) => t.status === 'completed').length;
            const prog   = cTasks.length ? Math.round((done / cTasks.length) * 100) : 0;
            return (
              <motion.div key={getId(c)} whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,.1)' }} transition={{ duration: 0.15 }}
                className="card p-5 cursor-pointer" onClick={() => setSelected(c)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{c.name}</h3>
                    <p className="text-[12.5px] text-slate-500 mt-0.5">{c.contact}</p>
                  </div>
                  <Badge variant={CLIENT_STATUS_CONFIG[c.status]?.tw?.replace('badge-','') || 'neutral'}>{c.status}</Badge>
                </div>
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {c.services.slice(0, 3).map((s) => <span key={s} className="badge badge-neutral text-[10.5px]">{s}</span>)}
                </div>
                {/* Progress bar */}
                {cTasks.length > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>{done}/{cTasks.length} tasks done</span>
                      <span>{prog}%</span>
                    </div>
                    <ProgressBar value={prog} height={5} />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={payVariant(c.paymentStatus)}>{c.paymentStatus}</Badge>
                  <span className="badge badge-neutral text-[10.5px]">{c.projectCount} projects</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-[15px] font-bold text-primary-600">{c.budget}</span>
                  <AvatarGroup users={team} max={3} size="xs" />
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && <div className="col-span-3"><EmptyState icon={Users} title="No clients found" description="Try a different search term." /></div>}
        </div>
      )}

      {/* List/Table */}
      {view === 'list' && (
        <div className="table-container">
          <table className="crm-table">
            <thead><tr>{['Client','Contact','Industry','Services','Status','Payment','Budget','Progress','Team'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((c) => {
                const team   = users.filter((u) => c.assignedTeam?.some((tm) => sameId(tm, u)));
                const cTasks = tasks.filter((t) => sameId(t.clientId, c));
                const done   = cTasks.filter((t) => t.status === 'completed').length;
                const prog   = cTasks.length ? Math.round((done / cTasks.length) * 100) : 0;
                return (
                  <tr key={getId(c)} className="cursor-pointer" onClick={() => setSelected(c)}>
                    <td className="font-semibold">{c.name}</td>
                    <td className="text-slate-500 text-[12px]">{c.contact}</td>
                    <td><Badge variant="neutral">{c.industry}</Badge></td>
                    <td><div className="flex gap-1">{c.services.slice(0,2).map((s) => <Badge key={s} variant="neutral" className="text-[10px]">{s}</Badge>)}</div></td>
                    <td><Badge variant={CLIENT_STATUS_CONFIG[c.status]?.tw?.replace('badge-','') || 'neutral'}>{c.status}</Badge></td>
                    <td><Badge variant={payVariant(c.paymentStatus)}>{c.paymentStatus}</Badge></td>
                    <td className="font-semibold text-primary-600">{c.budget}</td>
                    <td>
                      {cTasks.length > 0 ? (
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <ProgressBar value={prog} height={5} className="flex-1" />
                          <span className="text-[11px] text-slate-500">{prog}%</span>
                        </div>
                      ) : <span className="text-slate-400 text-[12px]">—</span>}
                    </td>
                    <td><AvatarGroup users={team} max={3} size="xs" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={Users} title="No clients found" description="Try a different search term." />}
        </div>
      )}
      {/* Add Client Modal */}
      <AddClientModal
        open={showAddClient}
        onClose={() => setShowAddClient(false)}
        users={users}
        onSave={(data) => { addClient(data).then(()=>setShowAddClient(false)); toast.success('Client added!'); }}
      />
    </Page>
  );
}