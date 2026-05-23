import { create } from 'zustand';
import {
  MOCK_USERS, MOCK_CLIENTS, MOCK_TASKS, MOCK_TODOS,
  MOCK_MEETINGS, MOCK_MESSAGES, MOCK_NOTIFICATIONS, generateHeatmapData,
} from '../mockData';

// ── localStorage helpers ─────────────────────────────────────
const saveLS = (key, data) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} };
const loadLS = (key, fallback) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; } };

// ── ID helpers ───────────────────────────────────────────────
const nextId  = (arr) => Math.max(0, ...arr.map((x) => x.id || 0)) + 1;
const today   = () => new Date().toISOString().split('T')[0];

// ── Timer helpers ────────────────────────────────────────────
const TIMER_KEY   = (id) => `crm_timer_v2_${id}`;
const WORKLOG_KEY = (id) => `crm_worklog_${id}`;

function saveTimerLS(userId, timer) {
  if (!userId) return;
  try { localStorage.setItem(TIMER_KEY(userId), JSON.stringify(timer)); } catch {}
  if (timer.sessionDate) {
    const log = loadWorkLogLS(userId);
    const idx = log.findIndex((e) => e.date === timer.sessionDate);
    const entry = { date: timer.sessionDate, workSeconds: timer.workSeconds || 0, sessionStart: timer.sessionStart, breaks: timer.breaks || [] };
    if (idx >= 0) log[idx] = entry; else log.unshift(entry);
    try { localStorage.setItem(WORKLOG_KEY(userId), JSON.stringify(log.slice(0, 60))); } catch {}
  }
}
function loadTimerLS(id) { try { const r = localStorage.getItem(TIMER_KEY(id)); return r ? JSON.parse(r) : null; } catch { return null; } }
function loadWorkLogLS(id) { try { const r = localStorage.getItem(WORKLOG_KEY(id)); return r ? JSON.parse(r) : []; } catch { return []; } }

function initialTimer() {
  return { active: false, workSeconds: 0, sessionDate: null, sessionStart: null, breaks: [], breakActive: false, currentBreak: null };
}

// ════════════════════════════════════════════════════════════
const useAppStore = create((set, get) => ({

  // ── State ──────────────────────────────────────────────────
  authUser:      null,
  users:         loadLS('crm_users',    MOCK_USERS),
  tasks:         loadLS('crm_tasks',    MOCK_TASKS),
  todos:         loadLS('crm_todos',    MOCK_TODOS),
  clients:       loadLS('crm_clients',  MOCK_CLIENTS),
  meetings:      loadLS('crm_meetings', MOCK_MEETINGS),
  messages:      MOCK_MESSAGES,
  notifications: MOCK_NOTIFICATIONS,
  heatmapData:   generateHeatmapData(),
  timer:         initialTimer(),
  sidebarOpen:   true,
  darkMode:      false,

  // ── UI ─────────────────────────────────────────────────────
  toggleSidebar:  () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => { const n = !s.darkMode; document.documentElement.classList.toggle('dark', n); return { darkMode: n }; }),

  // ── Notifications ──────────────────────────────────────────
  markAllRead:         () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, unread: false })) })),
  dismissNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  // ── Auth ───────────────────────────────────────────────────
  login: (user) => {
    const saved = loadTimerLS(user.id);
    const t = today();
    let timerState;
    if (saved && saved.sessionDate === t) {
      timerState = { ...saved, breakActive: false, currentBreak: null };
    } else {
      timerState = { ...initialTimer(), active: true, sessionDate: t, sessionStart: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    }
    set({ authUser: user, timer: timerState });
    saveTimerLS(user.id, timerState);
  },

  logout: () => {
    const { authUser } = get();
    if (authUser) localStorage.removeItem(TIMER_KEY(authUser.id));
    set({ authUser: null, timer: initialTimer() });
  },

  // ── Users ──────────────────────────────────────────────────
  addUser: (userData) => set((s) => {
    const user = {
      ...userData,
      id:       nextId(s.users),
      initials: userData.name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2),
      color:    ['#7C3AED','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6'][Math.floor(Math.random()*8)],
      status:   'offline', avatar: null, bio: '',
    };
    const users = [...s.users, user];
    saveLS('crm_users', users);
    return { users };
  }),

  deleteUser: (id) => set((s) => { const users = s.users.filter((u) => u.id !== id); saveLS('crm_users', users); return { users }; }),
  updateUser: (id, data) => set((s) => { const users = s.users.map((u) => u.id === id ? { ...u, ...data } : u); saveLS('crm_users', users); return { users }; }),

  // ── Tasks ──────────────────────────────────────────────────
  addTask: (task) => set((s) => {
    const tasks = [...s.tasks, { ...task, id: nextId(s.tasks), createdAt: today(), progress: 0 }];
    saveLS('crm_tasks', tasks); return { tasks };
  }),
  updateTask: (id, updates) => set((s) => {
    const tasks = s.tasks.map((t) => t.id === id ? { ...t, ...updates } : t);
    saveLS('crm_tasks', tasks); return { tasks };
  }),
  deleteTask: (id) => set((s) => { const tasks = s.tasks.filter((t) => t.id !== id); saveLS('crm_tasks', tasks); return { tasks }; }),
  moveTask: (id, status) => set((s) => {
    const tasks = s.tasks.map((t) => t.id === id ? { ...t, status, progress: status === 'completed' ? 100 : t.progress } : t);
    saveLS('crm_tasks', tasks); return { tasks };
  }),

  // ── Todos ──────────────────────────────────────────────────
  addTodo: (todo) => set((s) => {
    const todos = [...s.todos, { ...todo, id: nextId(s.todos), createdAt: today() }];
    saveLS('crm_todos', todos); return { todos };
  }),
  updateTodo: (id, updates) => set((s) => {
    const todos = s.todos.map((t) => t.id === id ? { ...t, ...updates } : t);
    saveLS('crm_todos', todos); return { todos };
  }),
  deleteTodo: (id) => set((s) => { const todos = s.todos.filter((t) => t.id !== id); saveLS('crm_todos', todos); return { todos }; }),

  // ── Clients ────────────────────────────────────────────────
  addClient: (client) => set((s) => {
    const clients = [...s.clients, { ...client, id: nextId(s.clients), notes: [], projectCount: 0 }];
    saveLS('crm_clients', clients); return { clients };
  }),
  updateClient: (id, updates) => set((s) => {
    const clients = s.clients.map((c) => c.id === id ? { ...c, ...updates } : c);
    saveLS('crm_clients', clients); return { clients };
  }),
  deleteClient: (id) => set((s) => { const clients = s.clients.filter((c) => c.id !== id); saveLS('crm_clients', clients); return { clients }; }),
  addClientNote: (clientId, text) => {
    const { authUser } = get();
    const note = { id: Date.now(), text, author: authUser?.name || 'Unknown', date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) };
    set((s) => {
      const clients = s.clients.map((c) => c.id === clientId ? { ...c, notes: [...(c.notes || []), note] } : c);
      saveLS('crm_clients', clients); return { clients };
    });
  },

  // ── Meetings ───────────────────────────────────────────────
  addMeeting: (meeting) => set((s) => {
    const meetings = [...s.meetings, { ...meeting, id: nextId(s.meetings) }];
    saveLS('crm_meetings', meetings); return { meetings };
  }),
  updateMeeting: (id, updates) => set((s) => {
    const meetings = s.meetings.map((m) => m.id === id ? { ...m, ...updates } : m);
    saveLS('crm_meetings', meetings); return { meetings };
  }),
  deleteMeeting: (id) => set((s) => { const meetings = s.meetings.filter((m) => m.id !== id); saveLS('crm_meetings', meetings); return { meetings }; }),

  // ── Messages (local state) ──────────────────────────────────
  sendMessage: (threadId, text, attachments = []) => {
    const { authUser } = get();
    if (!text?.trim() && attachments.length === 0) return;
    const msg = { id: Date.now(), userId: authUser.id, text: text?.trim() || '', attachments, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), date: 'Today' };
    set((s) => ({
      messages: {
        ...s.messages,
        threads: { ...s.messages.threads, [threadId]: [...(s.messages.threads[threadId] || []), msg] },
        channels: s.messages.channels.map((c) => c.id === threadId ? { ...c, unread: 0 } : c),
        dms:      s.messages.dms.map((d)      => d.id === threadId ? { ...d, unread: 0 } : d),
      },
    }));
  },
  deleteMessage: (threadId, msgId) => set((s) => ({
    messages: { ...s.messages, threads: { ...s.messages.threads, [threadId]: (s.messages.threads[threadId] || []).filter((m) => m.id !== msgId) } },
  })),

  // ── Work Timer ─────────────────────────────────────────────
  startTimer: () => set((s) => {
    const updated = { ...s.timer, active: true, breakActive: false, sessionDate: s.timer.sessionDate || today(), sessionStart: s.timer.sessionStart || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    saveTimerLS(s.authUser?.id, updated); return { timer: updated };
  }),
  pauseTimer: () => set((s) => { const updated = { ...s.timer, active: false }; saveTimerLS(s.authUser?.id, updated); return { timer: updated }; }),
  resetTimer: () => set((s) => { localStorage.removeItem(TIMER_KEY(s.authUser?.id)); return { timer: { ...initialTimer(), sessionDate: today() } }; }),
  tickTimer: () => set((s) => {
    if (!s.timer.active || s.timer.breakActive) return {};
    const workSeconds = s.timer.workSeconds + 1;
    const updated = { ...s.timer, workSeconds };
    if (workSeconds % 15 === 0) saveTimerLS(s.authUser?.id, updated);
    return { timer: updated };
  }),
  startBreak: (type, totalSeconds, reason = '') => set((s) => {
    const updated = { ...s.timer, active: false, breakActive: true, currentBreak: { type, reason, totalSeconds, elapsedSeconds: 0 } };
    saveTimerLS(s.authUser?.id, updated); return { timer: updated };
  }),
  tickBreak: () => set((s) => {
    if (!s.timer.breakActive || !s.timer.currentBreak) return {};
    const elapsed = s.timer.currentBreak.elapsedSeconds + 1;
    const { totalSeconds } = s.timer.currentBreak;
    if (elapsed >= totalSeconds) {
      const done = { type: s.timer.currentBreak.type, reason: s.timer.currentBreak.reason, planned: totalSeconds, actual: elapsed, endedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      const updated = { ...s.timer, active: true, breakActive: false, currentBreak: null, breaks: [...s.timer.breaks, done] };
      saveTimerLS(s.authUser?.id, updated); return { timer: updated };
    }
    const updated = { ...s.timer, currentBreak: { ...s.timer.currentBreak, elapsedSeconds: elapsed } };
    if (elapsed % 15 === 0) saveTimerLS(s.authUser?.id, updated);
    return { timer: updated };
  }),
  endBreak: () => set((s) => {
    if (!s.timer.currentBreak) return {};
    const done = { type: s.timer.currentBreak.type, reason: s.timer.currentBreak.reason, planned: s.timer.currentBreak.totalSeconds, actual: s.timer.currentBreak.elapsedSeconds, endedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    const updated = { ...s.timer, active: true, breakActive: false, currentBreak: null, breaks: [...s.timer.breaks, done] };
    saveTimerLS(s.authUser?.id, updated); return { timer: updated };
  }),

  // ── WorkLog ────────────────────────────────────────────────
  getWorkLog: (userId) => loadWorkLogLS(userId),
}));

export default useAppStore;
