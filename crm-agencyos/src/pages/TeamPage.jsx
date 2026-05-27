import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Search, UserCircle, Grid, List, Plus, Trash2, Mail, Phone, Building2, Calendar, Info, Utensils, Coffee } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/shallow';
import {
  Page, Avatar, Badge, ViewToggle, EmptyState,
  Modal, Input, Select, Button, ConfirmDialog,
  PriorityBadge, StatusBadge, ProgressBar, Tabs,
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
          <Info size={14} className="text-blue-550 flex-shrink-0 mt-0.5" />
          <span>The new member can log in using their email and password immediately after being added.</span>
        </div>
      </div>
    </Modal>
  );
}

// ── Member Card (grid) ────────────────────────────────────────
function MemberCard({ user, taskCount, completedCount, isCurrentUser, canDelete, onDelete, onSelect }) {
  const roleCfg = ROLE_CONFIG[user.role] || {};

  const isWorking = user.status === 'online' && user.timerActive && !user.timerBreakActive;
  // Heartbeat timeout: if online but haven't received socket sync in last 25s, treat as paused (background sleeping Chrome tab)
  const isTickingActive = isWorking && (!user.timerLastUpdated || (Date.now() - user.timerLastUpdated) < 25000);
  const isOnBreak = user.status === 'online' && user.timerBreakActive;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,.1)' }}
      onClick={() => onSelect(user)}
      className="card p-5 text-center relative group cursor-pointer"
    >
      {/* Delete button — admin/manager only, can't delete self */}
      {canDelete && !isCurrentUser && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(getId(user)); }}
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
              isOnBreak 
                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                : isTickingActive 
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse"
                  : "bg-slate-500/10 text-slate-400 border border-slate-500/10"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", 
                isOnBreak ? "bg-amber-500" : isTickingActive ? "bg-emerald-500 animate-ping" : "bg-slate-400"
              )} />
              {isOnBreak ? "On Break" : isTickingActive ? "Working" : "Paused"}
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
                      isOnBreak 
                        ? "bg-amber-500" 
                        : isTickingActive 
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

// ── Member Detail Modal ───────────────────────────────────────
function MemberDetailModal({ open, onClose, user, logs, loading, tasks, todos, activeTab, onTabChange }) {
  if (!user) return null;

  const userTasks = tasks.filter((t) => getId(t.assignedTo) === getId(user));
  const userTodos = todos.filter((t) => getId(t.userId) === getId(user));

  const activeTasks = userTasks.filter((t) => t.status !== 'completed');
  const completedTasks = userTasks.filter((t) => t.status === 'completed');
  const totalTasksCount = userTasks.length;
  
  const avgProgress = totalTasksCount > 0 
    ? Math.round(userTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / totalTasksCount)
    : 0;

  const totalDays = logs.length;
  const totalSeconds = logs.reduce((acc, l) => acc + (l.workSeconds || 0), 0);
  const avgSeconds = totalDays > 0 ? Math.round(totalSeconds / totalDays) : 0;

  const roleCfg = ROLE_CONFIG[user.role] || {};

  const tabs = [
    { value: 'tasks', label: 'Overview & Tasks', count: userTasks.length },
    { value: 'logs',  label: 'Work History & Breaks', count: logs.length },
    { value: 'todos', label: 'Daily Todos', count: userTodos.length },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${user.name} - Detailed Analytics`}
      size="xl"
    >
      <div className="px-6 py-6 flex flex-col h-full max-h-[80vh] overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-white/[0.02] mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-[28px] font-bold"
                style={{ background: user.color || '#6366f1' }}
              >
                {user.initials || user.name?.[0]}
              </div>
              <span
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800"
                style={{ background: statusColors[user.status] || '#94a3b8' }}
              />
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-slate-900 dark:text-white mb-0.5">{user.name}</h3>
              <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mb-2">{user.position || 'Team Member'}</p>
              <div className="flex gap-2">
                <span className={cn('badge text-[10.5px]', roleCfg.tw)}>{roleCfg.label || user.role}</span>
                <span className="badge badge-neutral text-[10.5px] capitalize">Department: {user.department || 'General'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5 text-[12px] text-slate-500 dark:text-slate-400 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700/60 pt-3 sm:pt-0 sm:pl-5 min-w-[200px]">
            <div className="flex items-center gap-2"><Mail size={13} className="text-slate-400" /> <span>{user.email}</span></div>
            <div className="flex items-center gap-2"><Phone size={13} className="text-slate-400" /> <span>{user.phone || 'No phone number'}</span></div>
            <div className="flex items-center gap-2"><Calendar size={13} className="text-slate-400" /> <span>Joined {user.joinDate || '—'}</span></div>
          </div>
        </div>

        <div className="flex border-b border-slate-100 dark:border-slate-700/80 mb-5 pb-3">
          <Tabs tabs={tabs} active={activeTab} onChange={onTabChange} />
        </div>

        <div className="flex-1 min-h-[300px]">
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50/50 dark:bg-white/[0.015] border border-slate-100 dark:border-slate-700/60 p-4 rounded-xl text-center">
                  <div className="text-[20px] font-bold text-slate-900 dark:text-white">{totalTasksCount}</div>
                  <div className="text-[11px] text-slate-400 uppercase font-semibold mt-0.5">Total Tasks</div>
                </div>
                <div className="bg-slate-50/50 dark:bg-white/[0.015] border border-slate-100 dark:border-slate-700/60 p-4 rounded-xl text-center">
                  <div className="text-[20px] font-bold text-slate-900 dark:text-white">{activeTasks.length}</div>
                  <div className="text-[11px] text-slate-400 uppercase font-semibold mt-0.5">Active Tasks</div>
                </div>
                <div className="bg-slate-50/50 dark:bg-white/[0.015] border border-slate-100 dark:border-slate-700/60 p-4 rounded-xl text-center">
                  <div className="text-[20px] font-bold text-slate-900 dark:text-white">{completedTasks.length}</div>
                  <div className="text-[11px] text-slate-400 uppercase font-semibold mt-0.5">Completed</div>
                </div>
                <div className="bg-slate-50/50 dark:bg-white/[0.015] border border-slate-100 dark:border-slate-700/60 p-4 rounded-xl text-center">
                  <div className="text-[20px] font-bold text-slate-900 dark:text-white">{avgProgress}%</div>
                  <div className="text-[11px] text-slate-400 uppercase font-semibold mt-0.5">Avg Progress</div>
                </div>
              </div>

              <div>
                <h4 className="text-[13.5px] font-bold text-slate-900 dark:text-white mb-3">Assigned Tasks</h4>
                {userTasks.length === 0 ? (
                  <p className="text-[12.5px] text-slate-400 italic py-6 text-center">No tasks assigned to this user.</p>
                ) : (
                  <div className="border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden">
                    <table className="crm-table text-[12.5px]">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-white/[0.015]">
                          <th className="py-2.5">Task Title</th>
                          <th className="py-2.5">Priority</th>
                          <th className="py-2.5">Status</th>
                          <th className="py-2.5">Due Date</th>
                          <th className="py-2.5">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userTasks.map((t) => (
                          <tr key={getId(t)} className="border-t border-slate-100 dark:border-slate-700/40">
                            <td className="font-medium py-2.5">{t.title}</td>
                            <td className="py-2.5"><PriorityBadge priority={t.priority} /></td>
                            <td className="py-2.5"><StatusBadge status={t.status} /></td>
                            <td className="text-slate-500 py-2.5">{t.dueDate || '—'}</td>
                            <td className="py-2.5 min-w-[120px]">
                              <div className="flex items-center gap-2">
                                <ProgressBar value={t.progress} className="flex-1" />
                                <span className="text-[11px] font-mono">{t.progress}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg className="animate-spin w-8 h-8 text-primary-500 mb-2" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
                  </svg>
                  <p className="text-[12.5px] text-slate-400">Loading work logs history...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50/50 dark:bg-white/[0.015] border border-slate-100 dark:border-slate-700/60 p-4 rounded-xl text-center">
                      <div className="text-[20px] font-bold text-slate-900 dark:text-white">{totalDays}</div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold mt-0.5">Days Worked</div>
                    </div>
                    <div className="bg-slate-50/50 dark:bg-white/[0.015] border border-slate-100 dark:border-slate-700/60 p-4 rounded-xl text-center">
                      <div className="text-[20px] font-bold text-slate-900 dark:text-white">{fmtHMS(totalSeconds)}</div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold mt-0.5">Total Time Logged</div>
                    </div>
                    <div className="bg-slate-50/50 dark:bg-white/[0.015] border border-slate-100 dark:border-slate-700/60 p-4 rounded-xl text-center">
                      <div className="text-[20px] font-bold text-slate-900 dark:text-white">{fmtHMS(avgSeconds)}</div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold mt-0.5">Avg Time / Day</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[13.5px] font-bold text-slate-900 dark:text-white mb-3">Daily Time Logs & Breaks</h4>
                    {logs.length === 0 ? (
                      <p className="text-[12.5px] text-slate-400 italic py-6 text-center">No time logs recorded in MongoDB yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {logs.map((log) => {
                          const logBreaks = log.breaks || [];
                          return (
                            <div key={log._id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/30 dark:bg-white/[0.005]">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-700/30">
                                <span className="text-[14px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
                                  {log.date}
                                </span>
                                <div className="flex items-center gap-3">
                                  <span className="text-[13px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                    Worked: {fmtHMS(log.workSeconds)}
                                  </span>
                                  {log.sessionStart && (
                                    <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
                                      Started: {log.sessionStart}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="mt-2 pl-2">
                                <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                  <Coffee size={12} className="text-slate-400 dark:text-slate-500" />
                                  <span>Breaks History</span>
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full font-bold">
                                    {logBreaks.length} {logBreaks.length === 1 ? 'break' : 'breaks'}
                                  </span>
                                </div>

                                {logBreaks.length === 0 ? (
                                  <p className="text-[11.5px] text-slate-400 italic pl-1">No breaks taken today.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                    {logBreaks.map((b, idx) => (
                                      <div key={idx} className="text-[11.5px] p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-lg flex items-start gap-2">
                                        <div className="flex-shrink-0 mt-0.5">
                                          {b.type === 'lunch' ? <Utensils size={13} className="text-amber-500" /> : <Coffee size={13} className="text-emerald-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
                                            <span className="capitalize">{b.type} Break</span>
                                            <span className="text-amber-500">{Math.round(b.actual / 60)} mins</span>
                                          </div>
                                          {b.reason && <p className="text-[10.5px] text-slate-400 mt-0.5 italic truncate">"{b.reason}"</p>}
                                          <p className="text-[9.5px] text-slate-400 mt-1">
                                            Planned: {Math.round(b.planned / 60)}m · Ended at {b.endedAt || '—'}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'todos' && (
            <div className="space-y-4">
              <h4 className="text-[13.5px] font-bold text-slate-900 dark:text-white mb-3">Daily Todos Checklist</h4>
              {userTodos.length === 0 ? (
                <p className="text-[12.5px] text-slate-400 italic py-6 text-center">No todos registered for this user.</p>
              ) : (
                <div className="border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden">
                  <table className="crm-table text-[12.5px]">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-white/[0.015]">
                        <th className="py-2.5">Todo Title</th>
                        <th className="py-2.5">Priority</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5">ETA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userTodos.map((td) => (
                        <tr key={getId(td)} className="border-t border-slate-100 dark:border-slate-700/40">
                          <td className={cn("font-medium py-2.5", td.status === 'completed' && "line-through text-slate-400")}>
                            {td.title}
                          </td>
                          <td className="py-2.5"><PriorityBadge priority={td.priority} /></td>
                          <td className="py-2.5"><StatusBadge status={td.status} /></td>
                          <td className="text-slate-500 py-2.5">{td.eta || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Main TeamPage ─────────────────────────────────────────────
export default function TeamPage() {
  const { authUser, users, tasks, todos, addUser, deleteUser } = useAppStore(useShallow((s) => ({
    authUser:   s.authUser,
    users:      s.users,
    tasks:      s.tasks,
    todos:      s.todos,
    addUser:    s.addUser,
    deleteUser: s.deleteUser,
  })));

  const [search,    setSearch]    = useState('');
  const [view,      setView]      = useState('grid');
  const [filter,    setFilter]    = useState('all');
  const [showAdd,   setShowAdd]   = useState(false);
  const [confirmDel,setConfirmDel]= useState(null); // user id to delete

  // Detailed Modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [userLogs, setUserLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [modalTab, setModalTab] = useState('tasks');

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setModalTab('tasks');
    setUserLogs([]);
    setLogsLoading(true);
    try {
      const logs = await useAppStore.getState().fetchWorkLog({ userId: getId(user) });
      setUserLogs(logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  const role      = authUser?.role;
  const isManager = canManage(role);

  // Dynamic ticking timer and initial hydration of today's logs
  useEffect(() => {
    useAppStore.getState().fetchTeamTimerStates?.();

    const intervalId = setInterval(() => {
      const now = Date.now();
      useAppStore.setState((s) => ({
        users: s.users.map((u) => {
          const isWorking = u.status === 'online' && u.timerActive && !u.timerBreakActive;
          // Check if we received a heartbeat socket sync within 25 seconds (since sync is every 10s)
          const isTickingActive = isWorking && (!u.timerLastUpdated || (now - u.timerLastUpdated) < 25000);

          if (isTickingActive) {
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
                  onSelect={handleSelectUser}
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
                    const isWorking = u.status === 'online' && u.timerActive && !u.timerBreakActive;
                    const isTicking = isWorking && (!u.timerLastUpdated || (Date.now() - u.timerLastUpdated) < 25000);
                    const isBrk    = u.status === 'online' && u.timerBreakActive;

                    return (
                      <motion.tr
                        key={getId(u)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => handleSelectUser(u)}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
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
                                  isBrk ? "bg-amber-500" : isTicking ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                                )} />
                                {fmtHMS(u.timerWorkSeconds)}
                              </span>
                              {u.timerSessionStart && (
                                <span className="text-[10px] text-slate-400">
                                  {isBrk ? "on break" : isTicking ? "working" : "paused"} · since {u.timerSessionStart}
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
                              onClick={(e) => { e.stopPropagation(); setConfirmDel(getId(u)); }}
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

      <MemberDetailModal
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        user={selectedUser}
        logs={userLogs}
        loading={logsLoading}
        tasks={tasks}
        todos={todos}
        activeTab={modalTab}
        onTabChange={setModalTab}
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