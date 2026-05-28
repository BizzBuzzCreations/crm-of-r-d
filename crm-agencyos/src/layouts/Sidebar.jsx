import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, ListTodo, Users, MessageSquare,
  BarChart3, Video, Calendar, Settings, LogOut, UserCircle,
  Pause, Play, Coffee, ChevronDown, ChevronUp, Timer, Utensils, Pencil
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { Avatar } from '../components/ui';
import { cn } from '../utils/helpers';

// ── Constants ─────────────────────────────────────────────────
const WORK_TARGET_S = 7 * 3600;
const LUNCH_S       = 40 * 60;
const TEA_S         = 20 * 60;

// ── Formatters ────────────────────────────────────────────────
const p2 = (n) => String(Math.floor(Math.max(0, n))).padStart(2, '0');
const fmtHMS = (s) => `${p2(s/3600)}:${p2((s%3600)/60)}:${p2(s%60)}`;
const fmtMS  = (s) => `${p2(s/60)}:${p2(s%60)}`;

// ── Break definitions ─────────────────────────────────────────
const BREAK_DEFS = [
  { type: 'lunch',  label: 'Lunch',   secs: LUNCH_S, icon: Utensils, color: '#f59e0b', time: '40:00' },
  { type: 'tea',    label: 'Tea',     secs: TEA_S,   icon: Coffee,   color: '#10b981', time: '20:00' },
  { type: 'custom', label: 'Custom',  secs: 0,       icon: Pause,    color: '#6366f1', time: null   },
];

// ── Member-only Timer Widget ──────────────────────────────────
function MemberTimer({ open }) {
  const timer    = useAppStore((s) => s.timer);
  const [breakMenuOpen, setBreakMenuOpen] = useState(false);
  const [showCustom,    setShowCustom]    = useState(false);
  const [customMins,    setCustomMins]    = useState('15');
  const [customReason,  setCustomReason]  = useState('');
  const [isEditingTarget, setIsEditingTarget] = useState(false);

  // ── Master tick using getState() to avoid stale closure ──────
  useEffect(() => {
    const id = setInterval(() => {
      const s = useAppStore.getState();
      if (!s.timer) return;
      if (s.timer.breakActive) s.tickBreak?.();
      else if (s.timer.active) s.tickTimer?.();
    }, 1000);
    return () => clearInterval(id);
  }, []); // run once on mount, never restart

  // ── Derived ───────────────────────────────────────────────
  const workSecs    = timer?.workSeconds || 0;
  const targetSecs  = timer?.targetSeconds || (8 * 3600);
  const pct         = Math.min(100, (workSecs / targetSecs) * 100);
  const leftSecs    = Math.max(0, targetSecs - workSecs);
  const leftHrs     = (leftSecs / 3600).toFixed(1);
  const workDone    = workSecs >= targetSecs;

  const brk         = timer?.currentBreak;
  const breakRemain = brk ? Math.max(0, brk.totalSeconds - brk.elapsedSeconds) : 0;
  const breakPct    = brk ? Math.min(100, (brk.elapsedSeconds / brk.totalSeconds) * 100) : 0;
  const breakDef    = brk ? BREAK_DEFS.find((b) => b.type === brk.type) : null;

  const {
    startTimer, pauseTimer, startBreak, endBreak,
  } = useAppStore.getState();

  const handleBreakStart = (type, secs, reason = '') => {
    useAppStore.getState().startBreak(type, secs, reason);
    setBreakMenuOpen(false);
    setShowCustom(false);
    setCustomMins('15');
    setCustomReason('');
  };

  const handleCustomStart = () => {
    const mins = parseInt(customMins, 10);
    if (!mins || mins < 1) return;
    handleBreakStart('custom', mins * 60, customReason || 'Custom break');
  };

  // ── Collapsed ─────────────────────────────────────────────
  if (!open) {
    const dotColor = timer?.breakActive ? '#f59e0b' : timer?.active ? '#10b981' : '#94a3b8';
    return (
      <div className="flex justify-center py-2 border-b border-sidebar-border mb-1">
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: dotColor }}
          title={fmtHMS(workSecs)}
        />
      </div>
    );
  }

  // ── Expanded ──────────────────────────────────────────────
  return (
    <div className="mx-2 mb-2 rounded-xl border border-white/[0.09]" style={{ background: 'rgba(255,255,255,0.045)' }}>

      {/* ── Active break card ── */}
      <AnimatePresence>
        {timer?.breakActive && brk && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="m-2.5 rounded-xl px-3 py-2.5"
              style={{ background: (breakDef?.color || '#6366f1') + '18', border: `1px solid ${breakDef?.color || '#6366f1'}35` }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {breakDef?.icon && <breakDef.icon size={13} style={{ color: breakDef?.color || '#6366f1' }} />}
                  <span className="text-[12px] font-bold" style={{ color: breakDef?.color || '#6366f1' }}>
                    {breakDef?.label || 'Break'} Break
                  </span>
                </div>
                <span className="font-mono text-[15px] font-bold" style={{ color: breakDef?.color || '#6366f1' }}>
                  {fmtMS(breakRemain)}
                </span>
              </div>
              {brk.reason && <p className="text-[10px] text-slate-400 italic mb-1.5">"{brk.reason}"</p>}
              <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ background: breakDef?.color || '#6366f1', width: `${breakPct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">{Math.ceil(breakRemain / 60)} min left</span>
                <button
                  onClick={() => useAppStore.getState().endBreak()}
                  className="text-[10.5px] font-semibold px-2 py-0.5 rounded border transition-colors"
                  style={{ borderColor: (breakDef?.color || '#6366f1') + '50', color: breakDef?.color || '#6366f1' }}
                >
                  End Early
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main display ── */}
      <div className="px-3 pt-3 pb-2.5">
        {/* Time + left */}
        <div className="flex items-start justify-between mb-1">
          <div className="font-mono text-[22px] font-bold text-white tracking-tight leading-none">
            {fmtHMS(workSecs)}
          </div>
          <div className="text-right flex flex-col items-end justify-center min-h-[34px]">
            {isEditingTarget ? (
              <select
                value={Math.round(targetSecs / 3600)}
                onChange={(e) => {
                  const hrs = parseInt(e.target.value, 10);
                  if (hrs >= 1 && hrs <= 24) {
                    useAppStore.getState().updateTargetSeconds(hrs * 3600);
                  }
                  setIsEditingTarget(false);
                }}
                onBlur={() => setIsEditingTarget(false)}
                autoFocus
                className="bg-slate-800 text-white border border-slate-700/60 rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-indigo-500 font-semibold cursor-pointer max-w-[90px]"
              >
                {[...Array(24)].map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1}h target</option>
                ))}
              </select>
            ) : (
              <div
                onClick={() => setIsEditingTarget(true)}
                className="group cursor-pointer text-right select-none"
                title="Click to adjust daily target time"
              >
                {workDone ? (
                  <div className="text-[11px] font-bold text-emerald-400 mt-0.5 flex items-center justify-end gap-1">
                    ✓ Goal met!
                    <Pencil size={9} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                  </div>
                ) : (
                  <>
                    <div className="text-[12px] font-bold text-white transition-colors group-hover:text-indigo-300">{leftHrs}h left</div>
                    <div className="text-[9.5px] text-slate-500 mt-0.5 flex items-center justify-end gap-1 transition-colors group-hover:text-indigo-400 font-medium">
                      of {Math.round(targetSecs / 3600)}h target
                      <Pencil size={8} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        {!timer?.breakActive && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-1.5 h-1.5 rounded-full"
              style={{ background: timer?.active ? '#10b981' : '#94a3b8' }} />
            <span className="text-[11.5px] font-semibold"
              style={{ color: timer?.active ? '#10b981' : '#94a3b8' }}>
              {timer?.active ? 'Working' : workSecs > 0 ? 'Paused' : 'Not started'}
            </span>
          </div>
        )}

        {/* Progress bar: 0h — % — target */}
        {!timer?.breakActive && (
          <div className="mb-3">
            <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${pct}%`,
                  background: workDone ? '#10b981' : timer?.active ? '#6366f1' : '#4b5563',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>0h</span>
              <span>{pct.toFixed(0)}%</span>
              <span>{Math.round(targetSecs / 3600)}h</span>
            </div>
          </div>
        )}

        {/* Buttons */}
        {!timer?.breakActive && (
          <div className="flex gap-2">
            {timer?.active ? (
              <button
                onClick={() => { setBreakMenuOpen((v) => !v); setShowCustom(false); }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12.5px] font-semibold text-white transition-all',
                  breakMenuOpen ? 'bg-amber-500' : ''
                )}
                style={!breakMenuOpen ? { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)' } : {}}
              >
                <Coffee size={12} /> Take a Break
                {breakMenuOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            ) : (
              <button
                onClick={() => useAppStore.getState().startTimer()}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12.5px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all"
              >
                <Play size={12} /> Start Timer
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Break menu (INLINE — not absolute, avoids overflow clip) ── */}
      <AnimatePresence>
        {breakMenuOpen && !timer?.breakActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-white/[0.07]"
          >
            <div className="p-2 space-y-0.5">
              {/* Lunch */}
              <button
                onClick={() => handleBreakStart('lunch', LUNCH_S)}
                className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.07] transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <Utensils size={14} className="text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-slate-200 group-hover:text-amber-300">Lunch</p>
                    <p className="text-[9.5px] text-slate-500">40 min · auto-resumes</p>
                  </div>
                </div>
                <span className="font-mono text-[11px] font-bold text-amber-400">40:00</span>
              </button>

              {/* Tea */}
              <button
                onClick={() => handleBreakStart('tea', TEA_S)}
                className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.07] transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <Coffee size={14} className="text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-slate-200 group-hover:text-emerald-300">Tea</p>
                    <p className="text-[9.5px] text-slate-500">20 min · auto-resumes</p>
                  </div>
                </div>
                <span className="font-mono text-[11px] font-bold text-emerald-400">20:00</span>
              </button>

              {/* Custom */}
              <button
                onClick={() => setShowCustom((v) => !v)}
                className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.07] transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <Pause size={14} className="text-indigo-400 flex-shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-slate-200 group-hover:text-indigo-300">Custom</p>
                    <p className="text-[9.5px] text-slate-500">Set your own time</p>
                  </div>
                </div>
                {showCustom ? <ChevronUp size={11} className="text-slate-400" /> : <ChevronDown size={11} className="text-slate-500" />}
              </button>

              {/* Custom form */}
              <AnimatePresence>
                {showCustom && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-2 pb-1 pt-1 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="number" min="1" max="120"
                          value={customMins}
                          onChange={(e) => setCustomMins(e.target.value)}
                          className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-indigo-500 text-center font-mono"
                          placeholder="mins"
                        />
                        <input
                          type="text"
                          value={customReason}
                          onChange={(e) => setCustomReason(e.target.value)}
                          className="flex-[2] bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-indigo-500 placeholder-slate-500"
                          placeholder="Reason (optional)"
                        />
                      </div>
                      <button
                        onClick={handleCustomStart}
                        className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold flex items-center justify-center gap-1 transition-colors"
                      >
                        <Timer size={11} /> Start Break
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────
const NAV = [
  {
    section: 'MENU',
    items: [
      { path: '/dashboard', label: 'Dashboard',         icon: LayoutDashboard, roles: ['admin','manager','member','client_relations'] },
      { path: '/todos',     label: 'Todos',        icon: ListTodo,        roles: ['admin','manager','member','client_relations'] },
      { path: '/tasks',     label: 'Tasks',        icon: CheckSquare,     roles: ['admin','manager','member','client_relations'] },
      { path: '/clients',   label: 'Clients & Projects', icon: Users,           roles: ['admin','manager','client_relations'] },
      { path: '/messages',  label: 'Messages',           icon: MessageSquare,   roles: ['admin','manager','member','client_relations'], badge: true },
      { path: '/meetings',  label: 'Meetings',           icon: Video,           roles: ['admin','manager','member','client_relations'] },
      { path: '/reports',   label: 'Reports',            icon: BarChart3,       roles: ['admin','manager','member','client_relations'] },
      { path: '/calendar',  label: 'Calendar',           icon: Calendar,        roles: ['admin','manager','member','client_relations'] },
    ],
  },
  {
    section: 'ADMIN',
    items: [
      { path: '/team', label: 'Team', icon: UserCircle, roles: ['admin', 'manager'] },
    ],
  },
  {
    section: 'ACCOUNT',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin','manager','member','client_relations'] },
    ],
  },
];

// ── Main Sidebar ──────────────────────────────────────────────
export default function Sidebar() {
  const authUser    = useAppStore((s) => s.authUser);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const messages    = useAppStore((s) => s.messages);
  const logout      = useAppStore((s) => s.logout);

  const role        = authUser?.role;
  const isMember    = role === 'member';
  const totalUnread = [...messages.channels, ...messages.dms].reduce((a, c) => a + (c.unread || 0), 0);

  return (
    <motion.aside
      className="flex flex-col bg-sidebar h-screen flex-shrink-0 border-r border-sidebar-border"
      style={{ overflow: 'visible' }}
      animate={{ width: sidebarOpen ? 232 : 58 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
    >
      {/* ── Logo ── */}
      <div className={cn(
        'flex items-center gap-2.5 px-3 py-4 border-b border-sidebar-border flex-shrink-0',
        !sidebarOpen && 'justify-center px-0'
      )}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-[13px] flex-shrink-0">
          BBC
        </div>
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="text-white font-bold text-[14px] leading-tight">BBC CRM</div>
              <div className="text-slate-500 text-[10.5px]">Team Workspace</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Timer — members only ── */}
      {isMember && <MemberTimer open={sidebarOpen} />}

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-1 px-2 space-y-0.5">
        {NAV.map(({ section, items }) => {
          const visible = items.filter((item) => item.roles.includes(role));
          if (!visible.length) return null;
          return (
            <div key={section} className="mb-1">
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.div
                    className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-600 px-2.5 py-1.5 mt-2"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  >
                    {section}
                  </motion.div>
                )}
              </AnimatePresence>

              {visible.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={!sidebarOpen ? item.label : undefined}
                  className={({ isActive }) => cn(
                    'relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 select-none',
                    !sidebarOpen && 'justify-center px-0',
                    isActive ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {!sidebarOpen && isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r" />
                      )}
                      <item.icon size={16} className="flex-shrink-0" />
                      <AnimatePresence>
                        {sidebarOpen && (
                          <motion.span
                            className="flex-1 text-[13px] font-medium truncate"
                            initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {sidebarOpen && item.badge && totalUnread > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-4">
                          {totalUnread}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* ── User + Logout ── */}
      <div className="border-t border-sidebar-border px-2 py-3 flex-shrink-0">
        <div className={cn('flex items-center gap-2.5 px-2.5 py-2 rounded-lg', !sidebarOpen && 'justify-center px-0')}>
          <Avatar user={authUser} size="sm" showStatus />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div className="flex-1 min-w-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-slate-200 text-[13px] font-semibold truncate">{authUser?.name}</div>
                <div className="text-slate-500 text-[11px] capitalize">{authUser?.role}</div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={logout} title="Logout"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors flex-shrink-0"
              >
                <LogOut size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        {!sidebarOpen && (
          <button onClick={logout} title="Logout"
            className="flex items-center justify-center w-full py-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors mt-1">
            <LogOut size={15} />
          </button>
        )}
      </div>
    </motion.aside>
  );
}
