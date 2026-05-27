import { create }  from 'zustand';
import { io }       from 'socket.io-client';
import toast        from 'react-hot-toast';
import {
  authAPI, usersAPI, clientsAPI, tasksAPI,
  todosAPI, meetingsAPI, messagesAPI, worklogAPI, revenueAPI, notificationsAPI,
} from '../services/api';

// ── Helpers ──────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0];

// ID normalizer: handles both populated objects and raw id strings
export const getId = (ref) => ref?._id || ref?.id || String(ref || '');
export const sameId = (a, b) => String(getId(a)) === String(getId(b));

// ── Timer localStorage (syncs to /api/worklog) ────────────────
const T_KEY = (id) => `crm_timer_v2_${id}`;
const saveTimerLS = (uid, t) => { try { localStorage.setItem(T_KEY(uid), JSON.stringify(t)); } catch {} };
const loadTimerLS = (uid)    => { try { const r = localStorage.getItem(T_KEY(uid)); return r ? JSON.parse(r) : null; } catch { return null; } };
const loadWorkLogLS = (uid)  => {
  try {
    const r = localStorage.getItem(`crm_worklog_${uid}`);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
};

function initialTimer() {
  return { active:false, workSeconds:0, sessionDate:null, sessionStart:null, breaks:[], breakActive:false, currentBreak:null, targetSeconds: 9 * 3600 };
}

// ── Default channels ──────────────────────────────────────────
const DEFAULT_CHANNELS = [
  { id:'general',       name:'general',       type:'channel', description:'Company-wide announcements', unread:0 },
  { id:'design',        name:'design',        type:'channel', description:'Design team discussions',    unread:0 },
  { id:'dev',           name:'development',   type:'channel', description:'Engineering updates',        unread:0 },
  { id:'marketing',     name:'marketing',     type:'channel', description:'Marketing and campaigns',    unread:0 },
  { id:'client-updates',name:'client-updates',type:'channel', description:'Client status updates',      unread:0 },
];

// ── Socket singleton ──────────────────────────────────────────
let sock = null;
let _beforeUnloadFn = null;  // reference so we can remove it on disconnect

const getSocketUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5000';
  const { protocol, hostname, port } = window.location;
  // Vite dev server runs on 5173; backend is always on 5000 in that case
  if (port === '5173') return 'http://localhost:5000';
  // Production: frontend and socket are served from the same origin
  return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
};

// Flush the timer to the DB using sendBeacon (fires even when tab closes)
function flushTimerToDb(store) {
  const { timer, authUser } = store.getState();
  if (!timer || !authUser) return;
  if (timer.workSeconds <= 0) return;
  const token = localStorage.getItem('crm_access_token');
  if (!token) return;
  const base = getSocketUrl();
  const body = JSON.stringify({
    date: timer.sessionDate || new Date().toISOString().split('T')[0],
    workSeconds: timer.workSeconds,
    sessionStart: timer.sessionStart,
    breaks: timer.breaks || [],
    active: false,   // tab is closing so mark inactive
    targetSeconds: timer.targetSeconds || 9 * 3600,
  });
  // sendBeacon is the only API that reliably fires on tab close
  navigator.sendBeacon(
    `${base}/api/worklog?_token=${encodeURIComponent(token)}`,
    new Blob([body], { type: 'application/json' })
  );
}

function connectSocket(token, store) {
  // Already connected — nothing to do
  if (sock?.connected) return;
  // Stale socket exists (e.g. failed after reconnectionAttempts) — clean it up first
  if (sock) { sock.removeAllListeners(); sock.disconnect(); sock = null; }

  sock = io(getSocketUrl(), {
    auth: { token },
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  sock.on('connect', () => {
    console.log('🔌 Socket connected:', getSocketUrl());
    store.setState({ socketConnected: true });
    // Register beforeunload flush (remove any previous listener first)
    if (_beforeUnloadFn) window.removeEventListener('beforeunload', _beforeUnloadFn);
    _beforeUnloadFn = () => flushTimerToDb(store);
    window.addEventListener('beforeunload', _beforeUnloadFn);
  });
  sock.on('disconnect', (reason) => {
    console.warn('🔌 Socket disconnected:', reason);
    store.setState({ socketConnected: false });
  });
  sock.on('connect_error', (err) => {
    console.error('🔌 Socket connection error:', err.message);
    store.setState({ socketConnected: false });
  });

  // Tasks (Section 11)
  sock.on('task:created', (t) => store.setState((s) => ({ tasks: [t, ...s.tasks] })));
  sock.on('task:updated', (t) => store.setState((s) => ({ tasks: s.tasks.map((x) => getId(x) === getId(t) ? t : x) })));
  sock.on('task:deleted', (id)=> store.setState((s) => ({ tasks: s.tasks.filter((x) => getId(x) !== String(id)) })));

  // Meetings
  sock.on('meeting:created', (m) => store.setState((s) => ({ meetings: [m, ...s.meetings] })));

  // Messages
  sock.on('message:new', (msg) => store.setState((s) => {
    let tid = msg.threadId;
    const myId = getId(s.authUser);
    if (tid && tid.startsWith('dm-') && tid.includes('-')) {
      const parts = tid.split('-');
      const otherId = parts[1] === myId ? parts[2] : parts[1];
      tid = `dm-${otherId}`;
    }
    const already = (s.messages.threads[tid] || []).some((x) => x._id === msg._id);
    if (already) return {};
    const msgWithLocalTid = { ...msg, threadId: tid };

    // Increment unread count if NOT currently viewing this thread
    let channels = s.messages.channels;
    let dms = s.messages.dms;
    if (tid !== s.activeThread) {
      const isChannel = channels.some((c) => c.id === tid);
      if (isChannel) {
        channels = channels.map((c) => c.id === tid ? { ...c, unread: (c.unread || 0) + 1 } : c);
      } else {
        dms = dms.map((d) => d.id === tid ? { ...d, unread: (d.unread || 0) + 1 } : d);
      }
    }

    return {
      messages: {
        ...s.messages,
        channels,
        dms,
        threads: {
          ...s.messages.threads,
          [tid]: [...(s.messages.threads[tid] || []), msgWithLocalTid]
        }
      }
    };
  }));
  sock.on('message:deleted', ({ id, threadId }) => store.setState((s) => {
    let tid = threadId;
    const myId = getId(s.authUser);
    if (tid && tid.startsWith('dm-') && tid.includes('-')) {
      const parts = tid.split('-');
      const otherId = parts[1] === myId ? parts[2] : parts[1];
      tid = `dm-${otherId}`;
    }
    return {
      messages: {
        ...s.messages,
        threads: {
          ...s.messages.threads,
          [tid]: (s.messages.threads[tid] || []).map((m) =>
            m._id === id ? { ...m, isDeleted: true } : m
          )
        }
      }
    };
  }));
  sock.on('message:updated', (msg) => store.setState((s) => {
    let tid = msg.threadId;
    const myId = getId(s.authUser);
    if (tid && tid.startsWith('dm-') && tid.includes('-')) {
      const parts = tid.split('-');
      const otherId = parts[1] === myId ? parts[2] : parts[1];
      tid = `dm-${otherId}`;
    }
    return {
      messages: {
        ...s.messages,
        threads: {
          ...s.messages.threads,
          [tid]: (s.messages.threads[tid] || []).map((m) => m._id === msg._id ? msg : m)
        }
      }
    };
  }));

  // Notifications
  sock.on('notification:new', (notif) => {
    store.setState((s) => ({ notifications: [notif, ...s.notifications] }));
  });

  // User presence
  sock.on('user:online',  ({ userId })         => store.setState((s) => ({ users: s.users.map((u) => getId(u) === userId ? { ...u, status:'online'  } : u) })));
  sock.on('user:offline', ({ userId })          => store.setState((s) => ({ users: s.users.map((u) => getId(u) === userId ? { ...u, status:'offline', timerActive: false, timerBreakActive: false } : u) })));
  sock.on('user:status',  ({ userId, status }) => store.setState((s) => ({ users: s.users.map((u) => getId(u) === userId ? { ...u, status } : u) })));

  sock.on('member:timer:update', (payload) => {
    store.setState((s) => ({
      users: s.users.map((u) =>
        getId(u) === payload.userId
          ? {
              ...u,
              timerActive:       payload.active,
              timerBreakActive:  payload.breakActive,
              timerWorkSeconds:  payload.workSeconds,
              timerSessionStart: payload.sessionStart,
              timerTargetSeconds:payload.targetSeconds,
            }
          : u
      ),
    }));
  });

  // Cross-session timer sync — adopt the authoritative value from another browser tab
  sock.on('timer:sync', (payload) => {
    store.setState((s) => {
      const incoming = payload.workSeconds ?? 0;
      // Always take the higher value (the tab that's been ticking longer wins)
      // Also sync active/break state so pause/resume propagates instantly
      const merged = {
        ...s.timer,
        workSeconds:  Math.max(s.timer.workSeconds, incoming),
        active:       payload.active       ?? s.timer.active,
        breakActive:  payload.breakActive  ?? s.timer.breakActive,
        sessionDate:  payload.sessionDate  || s.timer.sessionDate,
        sessionStart: payload.sessionStart || s.timer.sessionStart,
        targetSeconds:payload.targetSeconds|| s.timer.targetSeconds,
      };
      return { timer: merged };
    });
  });
}

function disconnectSocket() {
  if (_beforeUnloadFn) { window.removeEventListener('beforeunload', _beforeUnloadFn); _beforeUnloadFn = null; }
  if (sock) { sock.disconnect(); sock = null; }
}

// ════════════════════════════════════════════════════════════
const useAppStore = create((set, get, store) => ({

  // ── State ──────────────────────────────────────────────────
  authUser:   null,
  users:      [],
  tasks:      [],
  todos:      [],
  clients:    [],
  meetings:   [],
  mySchedule: [],
  revenueSummary: null,
  messages:   { channels: DEFAULT_CHANNELS, dms: [], threads: {} },
  notifications: [],
  timer:      initialTimer(),
  activeThread:'general',
  sidebarOpen:true,
  darkMode:   false,
  loading:    false,
  socketConnected: false,
  _loggingOut:false,

  // ── UI ─────────────────────────────────────────────────────
  toggleSidebar:  () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => { const n=!s.darkMode; document.documentElement.classList.toggle('dark',n); return { darkMode:n }; }),
  markAllRead: async () => {
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
    try { await notificationsAPI.markAllRead(); } catch {}
  },
  dismissNotification: async (id) => {
    set((s) => ({ notifications: s.notifications.filter((n) => n._id !== id) }));
    try { await notificationsAPI.delete(id); } catch {}
  },
  setActiveThread: (threadId) => {
    set({ activeThread: threadId });
    get().markThreadRead(threadId);
  },
  markThreadRead: (threadId) => set((s) => {
    const isChannel = s.messages.channels.some((c) => c.id === threadId);
    if (isChannel) {
      return {
        messages: {
          ...s.messages,
          channels: s.messages.channels.map((c) =>
            c.id === threadId ? { ...c, unread: 0 } : c
          )
        }
      };
    } else {
      return {
        messages: {
          ...s.messages,
          dms: s.messages.dms.map((d) =>
            d.id === threadId ? { ...d, unread: 0 } : d
          )
        }
      };
    }
  }),

  // ══════════════════════════════════════════════════════════
  // AUTH
  // ══════════════════════════════════════════════════════════
  login: async (email, password) => {
    try {
      const { data } = await authAPI.login({ email, password });
      localStorage.setItem('crm_access_token', data.accessToken);
      const user = data.user;

      // Timer: restore same-day from DB or localStorage or start fresh
      const today = todayStr();
      let dbTimer = null;
      try {
        const { data: wlData } = await worklogAPI.getAll();
        const logs = wlData?.data || [];
        const todayLog = logs.find(l => l.date === today);
        if (todayLog) {
          dbTimer = {
            active: todayLog.active,
            workSeconds: todayLog.workSeconds || 0,
            sessionDate: todayLog.date,
            sessionStart: todayLog.sessionStart || new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
            breaks: todayLog.breaks || [],
            breakActive: false,
            currentBreak: null,
            targetSeconds: todayLog.targetSeconds || (9 * 3600),
          };
        }
      } catch (err) {
        console.error('Failed to load timer from DB', err);
      }

      const saved = loadTimerLS(getId(user));
      let timerState = initialTimer();

      if (dbTimer && saved && saved.sessionDate === today) {
        timerState = {
          ...saved,
          workSeconds:  Math.max(dbTimer.workSeconds || 0, saved.workSeconds || 0),
          active:       dbTimer.active,
          breakActive:  dbTimer.breakActive,
          breaks:       saved.breaks?.length > dbTimer.breaks?.length ? saved.breaks : dbTimer.breaks,
        };
      } else if (dbTimer) {
        timerState = dbTimer;
      } else if (saved && saved.sessionDate === today) {
        timerState = { ...saved, breakActive: false, currentBreak: null };
      } else if (user.role === 'member') {
        timerState = { ...initialTimer(), active: true, sessionDate: today, sessionStart: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      }

      set({ authUser:user, timer:timerState, loading:false });
      saveTimerLS(getId(user), timerState);

      // If there was no DB log yet, create it so subsequent refreshes find it in the DB
      if (!dbTimer && user.role === 'member') {
        worklogAPI.upsert({
          date: timerState.sessionDate,
          workSeconds: timerState.workSeconds,
          sessionStart: timerState.sessionStart,
          breaks: timerState.breaks,
          active: timerState.active,
          breakActive: timerState.breakActive,
          targetSeconds: timerState.targetSeconds,
        }).catch(()=>{});
      }

      // Load all data then connect socket
      await get().loadAllData();
      connectSocket(data.accessToken, store);

      return { success:true, user };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      toast.error(msg);
      return { success:false, message:msg };
    }
  },

  logout: async () => {
    // Guard against re-entrant calls (crm:logout event can re-trigger this)
    if (get()._loggingOut) return;
    set({ _loggingOut: true });

    const { authUser, timer } = get();

    // Make API calls BEFORE removing the token so they still have auth
    if (authUser) {
      // Sync final worklog
      if (timer.workSeconds > 0) {
        worklogAPI.upsert({ date:timer.sessionDate||todayStr(), workSeconds:timer.workSeconds, sessionStart:timer.sessionStart, breaks:timer.breaks, active:false }).catch(()=>{});
      }
      worklogAPI.setActive(false).catch(()=>{});
    }
    try { await authAPI.logout(); } catch {}

    // NOW clear the token and state
    localStorage.removeItem('crm_access_token');
    disconnectSocket();
    set({ _loggingOut: false, socketConnected: false, authUser:null, users:[], tasks:[], todos:[], clients:[], meetings:[], timer:initialTimer(), messages:{ channels:DEFAULT_CHANNELS, dms:[], threads:{} }, notifications: [] });
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      await authAPI.changePassword({ currentPassword, newPassword });
      toast.success('Password updated successfully!');
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update password';
      toast.error(msg);
      return { success: false, message: msg };
    }
  },

  // Restore session on page reload using stored token
  restoreSession: async () => {
    const token = localStorage.getItem('crm_access_token');
    if (!token) return false;
    try {
      const { data } = await authAPI.me();
      const user = data.user;
      const today = todayStr();
      let dbTimer = null;
      try {
        const { data: wlData } = await worklogAPI.getAll();
        const logs = wlData?.data || [];
        const todayLog = logs.find(l => l.date === today);
        if (todayLog) {
          dbTimer = {
            active: todayLog.active,
            workSeconds: todayLog.workSeconds || 0,
            sessionDate: todayLog.date,
            sessionStart: todayLog.sessionStart || new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
            breaks: todayLog.breaks || [],
            breakActive: false,
            currentBreak: null,
            targetSeconds: todayLog.targetSeconds || (9 * 3600),
          };
        }
      } catch (err) {
        console.error('Failed to restore timer from DB', err);
      }

      const saved = loadTimerLS(getId(user));
      let timerState = initialTimer();

      if (dbTimer && saved && saved.sessionDate === today) {
        timerState = {
          ...saved,
          workSeconds:  Math.max(dbTimer.workSeconds || 0, saved.workSeconds || 0),
          active:       dbTimer.active,
          breakActive:  dbTimer.breakActive,
          breaks:       saved.breaks?.length > dbTimer.breaks?.length ? saved.breaks : dbTimer.breaks,
        };
      } else if (dbTimer) {
        timerState = dbTimer;
      } else if (saved && saved.sessionDate === today) {
        timerState = { ...saved, breakActive: false, currentBreak: null };
      }

      set({ authUser:user, timer:timerState });
      await get().loadAllData();
      // Re-read from localStorage: the 401 interceptor may have silently refreshed
      // the token during authAPI.me(), making the `token` variable above stale.
      connectSocket(localStorage.getItem('crm_access_token'), store);
      return true;
    } catch {
      localStorage.removeItem('crm_access_token');
      return false;
    }
  },

  // ══════════════════════════════════════════════════════════
  // LOAD ALL DATA
  // ══════════════════════════════════════════════════════════
  loadAllData: async () => {
    set({ loading:true });
    try {
      const [uR, cR, tR, dR, mR, nR] = await Promise.all([
        usersAPI.getAll(), clientsAPI.getAll(), tasksAPI.getAll(), todosAPI.getAll(), meetingsAPI.getAll(),
        notificationsAPI.getAll(),
      ]);
      const users = uR.data.data;
      const me    = get().authUser;
      const dms   = users
        .filter((u) => getId(u) !== getId(me))
        .map((u)   => ({ id:`dm-${getId(u)}`, userId:getId(u), unread:0 }));
      set({
        users,
        clients:       cR.data.data,
        tasks:         tR.data.data,
        todos:         dR.data.data,
        meetings:      mR.data.data,
        notifications: nR.data.data,
        messages:      { ...get().messages, dms },
        loading:       false,
      });
      await get().fetchMySchedule();
      if (me?.role === 'admin' || me?.role === 'manager') {
        await get().fetchRevenueSummary();
      }
    } catch (err) {
      console.error('loadAllData error:', err.message);
      set({ loading:false });
    }
  },

  // ══════════════════════════════════════════════════════════
  // USERS  — POST /api/users  PUT /api/users/:id  DELETE /api/users/:id
  // ══════════════════════════════════════════════════════════
  addUser: async (body) => {
    try {
      const { data } = await usersAPI.create(body);
      set((s) => ({ users: [...s.users, data.data] }));
      return data.data;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add user'); throw err; }
  },
  updateUser: async (id, body) => {
    try {
      const { data } = await usersAPI.update(id, body);
      set((s) => ({ users: s.users.map((u) => getId(u)===id ? data.data : u) }));
      return data.data;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update user'); throw err; }
  },
  deleteUser: async (id) => {
    try {
      await usersAPI.delete(id);
      set((s) => ({ users: s.users.filter((u) => getId(u)!==id) }));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete user'); throw err; }
  },

  // ══════════════════════════════════════════════════════════
  // CLIENTS  — GET/POST/PUT/DELETE /api/clients  POST /api/clients/:id/notes
  // ══════════════════════════════════════════════════════════
  addClient: async (body) => {
    try {
      const { data } = await clientsAPI.create(body);
      set((s) => ({ clients: [data.data, ...s.clients] }));
      return data.data;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add client'); throw err; }
  },
  updateClient: async (id, body) => {
    try {
      const { data } = await clientsAPI.update(id, body);
      set((s) => ({ clients: s.clients.map((c) => getId(c)===id ? data.data : c) }));
      return data.data;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update client'); throw err; }
  },
  deleteClient: async (id) => {
    try {
      await clientsAPI.delete(id);
      set((s) => ({ clients: s.clients.filter((c) => getId(c)!==id) }));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete client'); throw err; }
  },
  addClientNote: async (clientId, text) => {
    try {
      const { data } = await clientsAPI.addNote(clientId, text);
      set((s) => ({ clients: s.clients.map((c) => getId(c)===clientId ? data.data : c) }));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add note'); throw err; }
  },

  // ══════════════════════════════════════════════════════════
  // TASKS  — GET/POST/PUT/DELETE /api/tasks
  // Socket emits task:created / task:updated / task:deleted
  // ══════════════════════════════════════════════════════════
  addTask: async (body) => {
    try {
      const { data } = await tasksAPI.create(body);
      // Socket will push task:created — just return
      return data.data;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create task'); throw err; }
  },
  updateTask: async (id, body) => {
    // Optimistically update the store state immediately to eliminate latency and race conditions
    set((s) => ({
      tasks: s.tasks.map((t) => getId(t) === id ? { ...t, ...body } : t)
    }));
    try {
      const { data } = await tasksAPI.update(id, body);
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task');
      throw err;
    }
  },
  moveTask: async (id, status) => {
    const updates = { status };
    if (status === 'completed') updates.progress = 100;
    else if (status === 'pending') updates.progress = 0;
    else if (status === 'in-progress') updates.progress = 50;
    else if (status === 'sent-for-approval') updates.progress = 90;

    if (status === 'sent-for-approval' || status === 'completed') {
      updates.readyForApproval = false;
    }
    return get().updateTask(id, updates);
  },
  deleteTask: async (id) => {
    try {
      await tasksAPI.delete(id);
      // Socket will push task:deleted
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete task'); throw err; }
  },

  // ══════════════════════════════════════════════════════════
  // TODOS  — GET/POST/PUT/DELETE /api/todos
  // ══════════════════════════════════════════════════════════
  addTodo: async (body) => {
    try {
      const { data } = await todosAPI.create(body);
      set((s) => ({ todos: [data.data, ...s.todos] }));
      return data.data;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create todo'); throw err; }
  },
  updateTodo: async (id, body) => {
    try {
      const { data } = await todosAPI.update(id, body);
      set((s) => ({ todos: s.todos.map((t) => getId(t)===id ? data.data : t) }));
      return data.data;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update todo'); throw err; }
  },
  deleteTodo: async (id) => {
    try {
      await todosAPI.delete(id);
      set((s) => ({ todos: s.todos.filter((t) => getId(t)!==id) }));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete todo'); throw err; }
  },

  // ══════════════════════════════════════════════════════════
  // MEETINGS  — GET/POST/PUT/DELETE /api/meetings
  // ══════════════════════════════════════════════════════════
  addMeeting: async (body) => {
    try {
      const { data } = await meetingsAPI.schedule(body);
      await get().fetchMySchedule();
      return data.data;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to schedule meeting'); throw err; }
  },
  updateMeeting: async (id, body) => {
    try {
      const { data } = await meetingsAPI.update(id, body);
      set((s) => ({ meetings: s.meetings.map((m) => getId(m)===id ? data.data : m) }));
      return data.data;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update meeting'); throw err; }
  },
  deleteMeeting: async (id) => {
    try {
      await meetingsAPI.delete(id);
      set((s) => ({ meetings: s.meetings.filter((m) => getId(m)!==id) }));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete meeting'); throw err; }
  },
  fetchMySchedule: async () => {
    try {
      const { data } = await meetingsAPI.getMySchedule();
      set({ mySchedule: data.data || [] });
    } catch (err) {
      console.error('Error in fetchMySchedule Zustand:', err);
    }
  },
  submitRSVP: async (invitationId, status) => {
    try {
      const { data } = await meetingsAPI.rsvp(invitationId, status);
      set((s) => ({
        mySchedule: s.mySchedule.map((item) =>
          getId(item.invitationId) === invitationId
            ? { ...item, rsvpStatus: status }
            : item
        )
      }));
      // Also update standard meeting status in main list if present
      await get().loadAllData();
      toast.success(`RSVP updated to ${status}!`);
    } catch (err) {
      toast.error('Failed to submit RSVP');
    }
  },
  fetchRevenueSummary: async () => {
    try {
      const { data } = await revenueAPI.getSummary();
      set({ revenueSummary: data.data });
    } catch (err) {
      console.error('Error in fetchRevenueSummary Zustand:', err);
    }
  },
  recordRevenue: async (body) => {
    try {
      const { data } = await revenueAPI.record(body);
      await get().fetchRevenueSummary();
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record revenue');
      throw err;
    }
  },

  // ══════════════════════════════════════════════════════════
  // MESSAGES  — GET/POST/DELETE /api/messages/:threadId
  // Real-time via Socket.io (Section 11)
  // ══════════════════════════════════════════════════════════
  loadThread: async (threadId) => {
    try {
      const { data } = await messagesAPI.getThread(threadId);
      const mappedMsgs = (data.data || []).map((m) => ({ ...m, threadId }));
      set((s) => ({ messages: { ...s.messages, threads: { ...s.messages.threads, [threadId]: mappedMsgs } } }));
      sock?.emit('join:thread', threadId);
      return mappedMsgs;
    } catch (err) {
      return [];
    }
  },
  leaveThread: (threadId) => { sock?.emit('leave:thread', threadId); },

  sendMessage: async (threadId, text, attachments = []) => {
    if (!text?.trim() && attachments.length === 0) return null;
    try {
      let resp;
      if (attachments.length > 0) {
        const fd = new FormData();
        if (text?.trim()) fd.append('text', text.trim());
        attachments.forEach((a) => a.file && fd.append('files', a.file));
        resp = await messagesAPI.sendFiles(threadId, fd);
      } else {
        resp = await messagesAPI.send(threadId, text.trim());
      }
      const newMsg = { ...resp.data.data, threadId };
      set((s) => {
        const threadMsgs = s.messages.threads[threadId] || [];
        const already = threadMsgs.some((x) => x._id === newMsg._id);
        if (already) return {};
        return {
          messages: {
            ...s.messages,
            threads: {
              ...s.messages.threads,
              [threadId]: [...threadMsgs, newMsg]
            }
          }
        };
      });
      return newMsg;
    } catch (err) {
      toast.error('Failed to send message');
      throw err;
    }
  },
  deleteMessage: async (threadId, msgId) => {
    try {
      await messagesAPI.delete(msgId);
      set((s) => ({
        messages: {
          ...s.messages,
          threads: {
            ...s.messages.threads,
            [threadId]: (s.messages.threads[threadId] || []).map((m) =>
              m._id === msgId ? { ...m, isDeleted: true } : m
            )
          }
        }
      }));
    } catch {
      toast.error('Failed to delete message');
    }
  },
  toggleReaction: async (threadId, msgId, emoji = '👍') => {
    try {
      const { data: resp } = await messagesAPI.react(msgId, emoji);
      set((s) => ({
        messages: {
          ...s.messages,
          threads: {
            ...s.messages.threads,
            [threadId]: (s.messages.threads[threadId] || []).map((m) =>
              m._id === msgId ? resp.data : m
            )
          }
        }
      }));
    } catch {
      toast.error('Failed to toggle reaction');
    }
  },

  // Typing indicators (Section 11)
  emitTypingStart: (threadId) => sock?.emit('typing:start', { threadId }),
  emitTypingStop:  (threadId) => sock?.emit('typing:stop',  { threadId }),
  onTypingStart: (cb) => { sock?.on('typing:start', cb); return () => sock?.off('typing:start', cb); },
  onTypingStop:  (cb) => { sock?.on('typing:stop',  cb); return () => sock?.off('typing:stop',  cb); },

  // ══════════════════════════════════════════════════════════
  // WORK TIMER  (local tick → syncs to POST /api/worklog every 60s,
  //              cross-session sync via socket timer:sync every 10s)
  // ══════════════════════════════════════════════════════════

  // Helper: emit the current timer state to all other sessions of this user
  _emitTimerSync: () => {
    const { timer } = get();
    sock?.emit('timer:sync', {
      workSeconds:  timer.workSeconds,
      active:       timer.active,
      breakActive:  timer.breakActive,
      sessionDate:  timer.sessionDate,
      sessionStart: timer.sessionStart,
      targetSeconds:timer.targetSeconds,
    });
  },
  startTimer: () => set((s) => {
    const uid = getId(s.authUser);
    const upd = { ...s.timer, active:true, breakActive:false, sessionDate:s.timer.sessionDate||todayStr(), sessionStart:s.timer.sessionStart||new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };
    saveTimerLS(uid, upd);
    worklogAPI.upsert({ date:upd.sessionDate, workSeconds:upd.workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:true, breakActive:false, targetSeconds:upd.targetSeconds || (9 * 3600) }).catch(()=>{});
    worklogAPI.setActive(true).catch(()=>{});
    // Notify other sessions immediately
    sock?.emit('timer:sync', { workSeconds:upd.workSeconds, active:true, breakActive:false, sessionDate:upd.sessionDate, sessionStart:upd.sessionStart, targetSeconds:upd.targetSeconds });
    return { timer:upd };
  }),
  pauseTimer: () => set((s) => {
    const upd = { ...s.timer, active:false };
    saveTimerLS(getId(s.authUser), upd);
    worklogAPI.upsert({ date:upd.sessionDate||todayStr(), workSeconds:upd.workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:false, breakActive:false, targetSeconds:upd.targetSeconds || (9 * 3600) }).catch(()=>{});
    // Notify other sessions immediately so they pause too
    sock?.emit('timer:sync', { workSeconds:upd.workSeconds, active:false, breakActive:false, sessionDate:upd.sessionDate, sessionStart:upd.sessionStart, targetSeconds:upd.targetSeconds });
    return { timer:upd };
  }),
  resetTimer: () => set((s) => {
    localStorage.removeItem(T_KEY(getId(s.authUser)));
    return { timer:{ ...initialTimer(), sessionDate:todayStr() } };
  }),
  tickTimer: () => set((s) => {
    if (!s.timer.active || s.timer.breakActive) return {};
    const workSeconds = s.timer.workSeconds + 1;
    const upd = { ...s.timer, workSeconds };
    const uid = getId(s.authUser);
    if (workSeconds % 15 === 0) {
      saveTimerLS(uid, upd);
      // Sync to backend every 15s for high database accuracy
      worklogAPI.upsert({ date:upd.sessionDate||todayStr(), workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:true, breakActive:false, targetSeconds:upd.targetSeconds || (9 * 3600) }).catch(()=>{});
    }
    // Broadcast to other sessions every 10s to stay in sync
    if (workSeconds % 10 === 0) {
      sock?.emit('timer:sync', { workSeconds, active:true, breakActive:false, sessionDate:upd.sessionDate, sessionStart:upd.sessionStart, targetSeconds:upd.targetSeconds });
    }
    return { timer:upd };
  }),
  startBreak: (type, totalSeconds, reason='') => set((s) => {
    const upd = { ...s.timer, active:false, breakActive:true, currentBreak:{ type, reason, totalSeconds, elapsedSeconds:0 } };
    saveTimerLS(getId(s.authUser), upd);
    worklogAPI.upsert({ date:upd.sessionDate||todayStr(), workSeconds:upd.workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:false, breakActive:true, targetSeconds:upd.targetSeconds || (9 * 3600) }).catch(()=>{});
    // Notify other sessions — they should also show break state
    sock?.emit('timer:sync', { workSeconds:upd.workSeconds, active:false, breakActive:true, sessionDate:upd.sessionDate, sessionStart:upd.sessionStart, targetSeconds:upd.targetSeconds });
    return { timer:upd };
  }),
  tickBreak: () => set((s) => {
    if (!s.timer.breakActive || !s.timer.currentBreak) return {};
    const elapsed = s.timer.currentBreak.elapsedSeconds + 1;
    const { totalSeconds } = s.timer.currentBreak;
    if (elapsed >= totalSeconds) {
      const done = { type:s.timer.currentBreak.type, reason:s.timer.currentBreak.reason, planned:totalSeconds, actual:elapsed, endedAt:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };
      const upd  = { ...s.timer, active:true, breakActive:false, currentBreak:null, breaks:[...s.timer.breaks, done] };
      saveTimerLS(getId(s.authUser), upd);
      worklogAPI.upsert({ date:upd.sessionDate||todayStr(), workSeconds:upd.workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:true, breakActive:false, targetSeconds:upd.targetSeconds || (9 * 3600) }).catch(()=>{});
      sock?.emit('timer:sync', { workSeconds:upd.workSeconds, active:true, breakActive:false, sessionDate:upd.sessionDate, sessionStart:upd.sessionStart, targetSeconds:upd.targetSeconds });
      return { timer:upd };
    }
    const upd = { ...s.timer, currentBreak:{ ...s.timer.currentBreak, elapsedSeconds:elapsed } };
    if (elapsed % 15 === 0) saveTimerLS(getId(s.authUser), upd);
    if (elapsed % 10 === 0) {
      sock?.emit('timer:sync', { workSeconds:s.timer.workSeconds, active:false, breakActive:true, sessionDate:s.timer.sessionDate, sessionStart:s.timer.sessionStart, targetSeconds:s.timer.targetSeconds });
    }
    return { timer:upd };
  }),
  endBreak: () => set((s) => {
    if (!s.timer.currentBreak) return {};
    const done = { type:s.timer.currentBreak.type, reason:s.timer.currentBreak.reason, planned:s.timer.currentBreak.totalSeconds, actual:s.timer.currentBreak.elapsedSeconds, endedAt:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };
    const upd  = { ...s.timer, active:true, breakActive:false, currentBreak:null, breaks:[...s.timer.breaks, done] };
    saveTimerLS(getId(s.authUser), upd);
    worklogAPI.upsert({ date:upd.sessionDate||todayStr(), workSeconds:upd.workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:true, breakActive:false, targetSeconds:upd.targetSeconds || (9 * 3600) }).catch(()=>{});
    sock?.emit('timer:sync', { workSeconds:upd.workSeconds, active:true, breakActive:false, sessionDate:upd.sessionDate, sessionStart:upd.sessionStart, targetSeconds:upd.targetSeconds });
    return { timer:upd };
  }),
  updateTargetSeconds: async (seconds) => {
    const { authUser, timer } = get();
    if (!authUser) return;
    const upd = { ...timer, targetSeconds: seconds };
    set({ timer: upd });
    saveTimerLS(getId(authUser), upd);
    try {
      await worklogAPI.upsert({
        date: upd.sessionDate || todayStr(),
        workSeconds: upd.workSeconds,
        sessionStart: upd.sessionStart,
        breaks: upd.breaks,
        active: upd.active,
        targetSeconds: seconds
      });
      toast.success(`Target time updated to ${Math.round(seconds / 3600)}h`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save target time to database');
    }
  },

  // ── WorkLog reader (GET /api/worklog) ─────────────────────
  getWorkLog: (userId) => loadWorkLogLS(userId),   // local cache
  fetchWorkLog: async (params) => {
    try {
      const { data } = await worklogAPI.getAll(params);
      return data.data;
    } catch { return []; }
  },
  fetchTeamTimerStates: async () => {
    try {
      const today = todayStr();
      const logs = await get().fetchWorkLog({ date: today });
      set((s) => ({
        users: s.users.map((u) => {
          const log = logs.find((l) => getId(l.userId) === getId(u));
          if (log) {
            return {
              ...u,
              timerActive:       log.active,
              timerBreakActive:  log.breakActive,
              timerWorkSeconds:  log.workSeconds || 0,
              timerSessionStart: log.sessionStart,
              timerTargetSeconds:log.targetSeconds || 9 * 3600,
            };
          }
          return u;
        })
      }));
    } catch (err) {
      console.error('Failed to fetch team timer states:', err);
    }
  },
}));

export default useAppStore;