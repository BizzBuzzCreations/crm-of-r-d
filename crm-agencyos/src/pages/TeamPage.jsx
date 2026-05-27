import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Search, UserCircle, Grid, List, Plus, Trash2, Mail, Phone, Building2 } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/shallow';
import {
  Page, Avatar, Badge, ViewToggle, EmptyState,
  Modal, Input, Select, Button, ConfirmDialog,
} from '../components/ui';
import { cn, getId, sameId, ROLE_CONFIG, canManage } from '../utils/helpers';

const statusColors = { online: '#10b981', away: '#f59e0b', offline: '#94a3b8' };
const statusLabels = { online: 'Online', away: 'Away', offline: 'Offline' };

const p2 = (n) => String(Math.floor(Math.max(0, n))).padStart(2, '0');
const fmtHMS = (s) => `${p2(s/3600)}:${p2((s%3600)/60)}:${p2(s%60)}`;

const DEPARTMENTS = ['Marketing'];
const POSITIONS   = [
  'Developer','Graphic Designer',
  'Video Editor','SEO','HR',
  'BDE','SMM','Other',
];

// ── Add Member Modal ──────────────────────────────────────────
function AddMemberModal({ open, onClose, onSave }) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: { role: 'member', status: 'offline' },
  });

  const onSubmit = (data) => {
    onSave(data);
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Add New Team Member"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)}>
            <Plus size={14} /> Add Member
          </Button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-4">
        {/* Name + Email */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Full Name *"
            placeholder="e.g. John Smith"
            error={errors.name?.message}
            {...register('name', { required: 'Full name is required' })}
          />
          <Input
            label="Email *"
            type="email"
            placeholder="john@agency.com"
            error={errors.email?.message}
            {...register('email', { required: 'Email is required' })}
          />
        </div>

        {/* Password */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Password *"
            type="password"
            placeholder="Minimum 6 characters"
            error={errors.password?.message}
            {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
          />
          <Input
            label="Phone"
            placeholder="+1 (555) 000-0000"
            {...register('phone')}
          />
        </div>

        {/* Role + Department */}
        <div className="grid grid-cols-2 gap-4">
          <Select label="Role *" {...register('role', { required: true })}>
            <option value="member">Member</option>
            <option value="manager">Manager</option>
          </Select>
          <Select label="Department" {...register('department')}>
            <option value="">Select department…</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        </div>

        {/* Position */}
        <Select label="Job Position" {...register('position')}>
          <option value="">Select position…</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>

        {/* Join date */}
        <Input
          label="Join Date"
          type="date"
          {...register('joinDate')}
        />

        {/* Info note */}
        <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800 rounded-xl text-[12.5px] text-blue-700 dark:text-blue-300">
          <span className="text-base">ℹ️</span>
          <span>The new member can log in using their email and password immediately after being added.</span>
        </div>
      </div>
    </Modal>
  );
}

// ── Member Card (grid) ────────────────────────────────────────
function MemberCard({ user, taskCount, completedCount, isCurrentUser, canDelete, onDelete }) {
  const roleCfg = ROLE_CONFIG[user.role] || {};

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,.1)' }}
      className="card p-5 text-center relative group"
    >
      {/* Delete button — admin/manager only, can't delete self */}
      {canDelete && !isCurrentUser && (
        <button
          onClick={() => onDelete(getId(user))}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          title="Remove member"
        >
          <Trash2 size={13} />
        </button>
      )}

      {/* Avatar */}
      <div className="relative inline-block mb-3">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[22px] font-bold mx-auto"
          style={{ background: user.color || '#6366f1' }}
        >
          {user.initials || user.name?.[0]}
        </div>
        <span
          className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800"
          style={{ background: statusColors[user.status] || '#94a3b8' }}
        />
      </div>

      <h3 className="text-[14.5px] font-bold text-slate-900 dark:text-white mb-0.5">{user.name}</h3>
      <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-2">{user.position || 'Team Member'}</p>

      <div className="flex justify-center gap-2 mb-3">
        <span className={cn('badge text-[10.5px]', roleCfg.tw)}>{roleCfg.label || user.role}</span>
        <span className="badge badge-neutral text-[10.5px] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColors[user.status] || '#94a3b8' }} />
          {statusLabels[user.status] || 'Offline'}
        </span>
      </div>

      {/* Dynamic Timer Status Widget */}
      {user.role === 'member' && user.timerWorkSeconds !== undefined && user.timerWorkSeconds > 0 && (
        <div className="mt-1 mb-4 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wide uppercase text-slate-400 dark:text-slate-500">
              Worked Today
            </span>
            <span className={cn(
              "text-[9.5px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1",
              user.timerBreakActive 
                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                : user.timerActive 
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse"
                  : "bg-slate-500/10 text-slate-400 border border-slate-500/10"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", 
                user.timerBreakActive ? "bg-amber-500" : user.timerActive ? "bg-emerald-500 animate-ping" : "bg-slate-400"
              )} />
              {user.timerBreakActive ? "On Break" : user.timerActive ? "Working" : "Paused"}
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[16px] font-mono font-bold text-slate-800 dark:text-slate-200">
              {fmtHMS(user.timerWorkSeconds)}
            </span>
            {user.timerSessionStart && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Started {user.timerSessionStart}
              </span>
            )}
          </div>

          {/* Elegant Progress Bar toward Target Hours */}
          {(() => {
            const target = user.timerTargetSeconds || (9 * 3600);
            const progressPct = Math.min(100, (user.timerWorkSeconds / target) * 100);
            return (
              <div className="w-full">
                <div className="h-1 w-full bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      user.timerBreakActive 
                        ? "bg-amber-500" 
                        : user.timerActive 
                          ? "bg-gradient-to-r from-emerald-500 to-indigo-500"
                          : "bg-slate-400"
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-slate-400 dark:text-slate-500 font-semibold">
                  <span>{Math.round(progressPct)}% of target</span>
                  <span>{Math.round(target / 3600)}h target</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Stats */}
      <div className="flex justify-center gap-5 pt-3 border-t border-slate-100 dark:border-slate-700">
        <div>
          <div className="text-[18px] font-bold text-slate-900 dark:text-white">{taskCount}</div>
          <div className="text-[10.5px] text-slate-500">Active Tasks</div>
        </div>
        <div>
          <div className="text-[18px] font-bold text-slate-900 dark:text-white">{completedCount}</div>
          <div className="text-[10.5px] text-slate-500">Completed</div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main TeamPage ─────────────────────────────────────────────
export default function TeamPage() {
  const { authUser, users, tasks, addUser, deleteUser } = useAppStore(useShallow((s) => ({
    authUser:   s.authUser,
    users:      s.users,
    tasks:      s.tasks,
    addUser:    s.addUser,
    deleteUser: s.deleteUser,
  })));

  const [search,    setSearch]    = useState('');
  const [view,      setView]      = useState('grid');
  const [filter,    setFilter]    = useState('all');
  const [showAdd,   setShowAdd]   = useState(false);
  const [confirmDel,setConfirmDel]= useState(null); // user id to delete

  const role      = authUser?.role;
  const isManager = canManage(role);

  // Dynamic ticking timer and initial hydration of today's logs
  useEffect(() => {
    useAppStore.getState().fetchTeamTimerStates?.();

    const intervalId = setInterval(() => {
      useAppStore.setState((s) => ({
        users: s.users.map((u) => {
          if (u.timerActive && !u.timerBreakActive) {
            return { ...u, timerWorkSeconds: (u.timerWorkSeconds || 0) + 1 };
          }
          return u;
        })
      }));
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const filtered = users.filter((u) => {
    const matchSearch = !search
      || u.name.toLowerCase().includes(search.toLowerCase())
      || (u.position || '').toLowerCase().includes(search.toLowerCase())
      || (u.department || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = filter === 'all' || u.role === filter;
    return matchSearch && matchRole;
  });

  const getTaskCount      = (uid) => tasks.filter((t) => getId(t.assignedTo) === getId(uid) && t.status !== 'completed').length;
  const getCompletedCount = (uid) => tasks.filter((t) => getId(t.assignedTo) === getId(uid) && t.status === 'completed').length;

  const handleAddMember = async (data) => {
    try {
      await addUser({
        name:       data.name,
        email:      data.email,
        password:   data.password,
        role:       data.role || 'member',
        position:   data.position || 'Team Member',
        department: data.department || 'General',
        phone:      data.phone || '',
        joinDate:   data.joinDate
          ? new Date(data.joinDate + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
          : new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
      });
      toast.success(`${data.name} has been added to the team!`);
      setShowAdd(false);
    } catch {}
  };

  const handleDelete = async (id) => {
    const u = users.find((u) => getId(u) === id);
    await deleteUser(id).catch(()=>{});
    toast.success(`${u?.name || 'Member'} removed from team.`);
  };

  return (
    <Page>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">Team Members</h1>
          <p className="page-sub">
            {users.length} members · {users.filter((u) => u.status === 'online').length} online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle
            views={[
              { value: 'grid', icon: Grid, label: 'Grid' },
              { value: 'list', icon: List, label: 'List' },
            ]}
            active={view}
            onChange={setView}
          />
          {/* Add Member — admin/manager only */}
          {isManager && (
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add Member
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="form-input pl-9 py-1.5 text-[13px]"
            placeholder="Search team…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {['all', 'admin', 'manager', 'member'].map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12.5px] font-medium capitalize transition-all',
                filter === r
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 hover:bg-slate-50'
              )}
            >
              {r === 'all' ? 'All Roles' : r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid view ── */}
      {view === 'grid' && (
        filtered.length === 0 ? (
          <EmptyState
            icon={UserCircle}
            title="No members found"
            description={users.length === 0 ? 'Add your first team member using the button above.' : 'Try a different search or filter.'}
            action={isManager && users.length === 0 && (
              <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
                <Plus size={13} /> Add First Member
              </Button>
            )}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {filtered.map((u) => (
                <MemberCard
                  key={getId(u)}
                  user={u}
                  taskCount={getTaskCount(getId(u))}
                  completedCount={getCompletedCount(getId(u))}
                  isCurrentUser={sameId(u, authUser)}
                  canDelete={isManager}
                  onDelete={(id) => setConfirmDel(id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )
      )}

      {/* ── List / Table view ── */}
      {view === 'list' && (
        filtered.length === 0 ? (
          <EmptyState icon={UserCircle} title="No members found" description="Try a different filter." />
        ) : (
          <div className="table-container">
            <table className="crm-table">
              <thead>
                <tr>
                  {['Member','Role','Department','Status','Worked Today','Email','Phone','Active Tasks','Joined','Actions'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((u) => {
                    const roleCfg = ROLE_CONFIG[u.role] || {};
                    const isSelf  = sameId(u, authUser);
                    return (
                      <motion.tr
                        key={getId(u)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[13px] font-bold"
                                style={{ background: u.color || '#6366f1' }}
                              >
                                {u.initials || u.name?.[0]}
                              </div>
                              <span
                                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800"
                                style={{ background: statusColors[u.status] || '#94a3b8' }}
                              />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white text-[13.5px]">{u.name}</p>
                              <p className="text-[11.5px] text-slate-500">{u.position || 'Team Member'}</p>
                            </div>
                          </div>
                        </td>
                        <td><Badge className={cn('text-[10.5px]', roleCfg.tw)}>{roleCfg.label || u.role}</Badge></td>
                        <td className="text-slate-600 dark:text-slate-400">{u.department || '—'}</td>
                        <td>
                          <span className="flex items-center gap-1.5 text-[12.5px]">
                            <span className="w-2 h-2 rounded-full" style={{ background: statusColors[u.status] || '#94a3b8' }} />
                            {statusLabels[u.status] || 'Offline'}
                          </span>
                        </td>
                        <td>
                          {u.role === 'member' && u.timerWorkSeconds !== undefined && u.timerWorkSeconds > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[12.5px] flex items-center gap-1.5">
                                <span className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  u.timerBreakActive ? "bg-amber-500" : u.timerActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                                )} />
                                {fmtHMS(u.timerWorkSeconds)}
                              </span>
                              {u.timerSessionStart && (
                                <span className="text-[10px] text-slate-400">
                                  {u.timerBreakActive ? "on break" : u.timerActive ? "working" : "paused"} · since {u.timerSessionStart}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[12px]">—</span>
                          )}
                        </td>
                        <td className="text-slate-500 text-[12px]">{u.email}</td>
                        <td className="text-slate-500 text-[12px]">{u.phone || '—'}</td>
                        <td>
                          <Badge variant={getTaskCount(getId(u)) > 0 ? 'warning' : 'success'}>
                            {getTaskCount(getId(u))}
                          </Badge>
                        </td>
                        <td className="text-slate-500 text-[12px]">{u.joinDate || '—'}</td>
                        <td>
                          {isManager && !isSelf && (
                            <button
                              onClick={() => setConfirmDel(getId(u))}
                              className="btn-icon text-slate-400 hover:text-red-500 p-1.5"
                              title="Remove member"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          {isSelf && <span className="text-[11.5px] text-slate-400 italic">You</span>}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modals */}
      <AddMemberModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleAddMember}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => { handleDelete(confirmDel); setConfirmDel(null); }}
        title="Remove Team Member"
        message={`Remove ${users.find((u) => getId(u) === confirmDel)?.name || 'this member'} from the team? Their tasks will remain but they will lose access.`}
        confirmLabel="Remove Member"
        variant="danger"
      />
    </Page>
  );
}