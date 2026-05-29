import { create }  from 'zustand';
import { io }       from 'socket.io-client';
import toast        from 'react-hot-toast';
import {
  authAPI, usersAPI, clientsAPI, tasksAPI,
  todosAPI, meetingsAPI, messagesAPI, worklogAPI, revenueAPI, notificationsAPI, channelsAPI, servicesAPI, projectsAPI,
  settingsAPI,
} from '../services/api';

// ── Helpers ──────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0];

// ID normalizer: handles both populated objects and raw id strings
export const getId = (ref) => ref?._id || ref?.id || String(ref || '');
export const sameId = (a, b) => String(getId(a)) === String(getId(b));

// ── Unread-count localStorage (survives page reloads) ────────
const U_KEY  = (uid) => `crm_unread_${uid}`;
const saveUnreadLS  = (uid, map) => { try { localStorage.setItem(U_KEY(uid), JSON.stringify(map)); } catch {} };
const loadUnreadLS  = (uid) => { try { const r = localStorage.getItem(U_KEY(uid)); return r ? JSON.parse(r) : {}; } catch { return {}; } };
const clearUnreadLS = (uid) => { try { localStorage.removeItem(U_KEY(uid)); } catch {} };

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
  return { active:false, workSeconds:0, sessionDate:null, sessionStart:null, breaks:[], breakActive:false, currentBreak:null, targetSeconds: 8 * 3600, lastTickTime: null };
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
let _focusHandler = null;
let _visibilityHandler = null;

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
    targetSeconds: timer.targetSeconds || 8 * 3600,
  });
  // sendBeacon is the only API that reliably fires on tab close
  navigator.sendBeacon(
    `${base}/api/worklog?_token=${encodeURIComponent(token)}`,
    new Blob([body], { type: 'application/json' })
  );
}

function connectSocket(store) {
  // Already connected — nothing to do
  if (sock?.connected) return;
  // Stale socket exists (e.g. failed after reconnectionAttempts) — clean it up first
  if (sock) { sock.removeAllListeners(); sock.disconnect(); sock = null; }

  // Use a callback so Socket.IO reads the CURRENT token on every reconnect attempt,
  // not the stale one captured at initial connect time (token may have been refreshed).
  sock = io(getSocketUrl(), {
    auth: (cb) => { cb({ token: localStorage.getItem('crm_access_token') }); },
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  // Helper: refresh auth token on the socket object before manual reconnects
  const refreshSocketAuth = () => {
    if (sock) sock.auth = { token: localStorage.getItem('crm_access_token') };
  };

  // Reconnect automatically on window focus or visibility change if disconnected
  if (_focusHandler) window.removeEventListener('focus', _focusHandler);
  _focusHandler = () => {
    if (sock && !sock.connected) {
      console.log('🔌 Window focused and socket disconnected — attempting reconnect');
      refreshSocketAuth();
      sock.connect();
    }
  };
  window.addEventListener('focus', _focusHandler);

  if (_visibilityHandler) window.removeEventListener('visibilitychange', _visibilityHandler);
  _visibilityHandler = () => {
    if (document.visibilityState === 'visible' && sock && !sock.connected) {
      console.log('🔌 Tab visible and socket disconnected — attempting reconnect');
      refreshSocketAuth();
      sock.connect();
    }
  };
  window.addEventListener('visibilitychange', _visibilityHandler);

  sock.on('connect', () => {
    console.log('🔌 Socket connected:', getSocketUrl());
    store.setState({ socketConnected: true });
    // Register beforeunload flush (remove any previous listener first)
    if (_beforeUnloadFn) window.removeEventListener('beforeunload', _beforeUnloadFn);
    _beforeUnloadFn = () => flushTimerToDb(store);
    window.addEventListener('beforeunload', _beforeUnloadFn);

    // Immediately broadcast current timer state so admins/managers see it right away
    const { timer, authUser } = store.getState();
    if (timer && authUser && timer.active !== undefined) {
      sock?.emit('timer:sync', {
        workSeconds:  timer.workSeconds,
        active:       timer.active,
        breakActive:  timer.breakActive,
        sessionDate:  timer.sessionDate,
        sessionStart: timer.sessionStart,
        targetSeconds:timer.targetSeconds,
      });
    }
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

  // Todos
  sock.on('todo:created', (t) => store.setState((s) => {
    // Use sameId for reliable string-based comparison (avoids ObjectId === failures)
    const already = s.todos.some((x) => sameId(x, t));
    if (already) return {};
    return { todos: [t, ...s.todos] };
  }));
  sock.on('todo:updated', (t) => store.setState((s) => ({ todos: s.todos.map((x) => getId(x) === getId(t) ? t : x) })));
  sock.on('todo:deleted', (id)=> store.setState((s) => ({ todos: s.todos.filter((x) => getId(x) !== String(id)) })));

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
      // Persist so the badge survives page reloads
      const uid = getId(s.authUser);
      if (uid) {
        const saved = loadUnreadLS(uid);
        saved[tid] = (saved[tid] || 0) + 1;
        saveUnreadLS(uid, saved);
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

  // Dynamic channels
  sock.on('channel:created', (ch) => store.setState((s) => {
    const formatted = { 
      id: ch._id, 
      name: ch.name, 
      type: 'channel', 
      description: ch.description || '', 
      isPrivate: !!ch.isPrivate, 
      members: ch.members || [],
      unread: 0 
    };
    if (s.messages.channels.some((c) => c.id === ch._id)) return {};
    sock?.emit('join:thread', ch._id);
    return {
      messages: {
        ...s.messages,
        channels: [...s.messages.channels, formatted]
      }
    };
  }));

  sock.on('channel:updated', (ch) => store.setState((s) => {
    return {
      messages: {
        ...s.messages,
        channels: s.messages.channels.map((c) =>
          c.id === ch._id
            ? { 
                ...c, 
                name: ch.name, 
                description: ch.description || '',
                isPrivate: !!ch.isPrivate,
                members: ch.members || []
              }
            : c
        )
      }
    };
  }));

  sock.on('channel:deleted', (id) => store.setState((s) => {
    const newChannels = s.messages.channels.filter((c) => c.id !== String(id));
    let activeThread = s.activeThread;
    if (activeThread === String(id)) {
      activeThread = newChannels[0]?.id || 'general';
    }
    return {
      activeThread,
      messages: {
        ...s.messages,
        channels: newChannels
      }
    };
  }));

  // User presence
  sock.on('user:online',  ({ userId }) => {
    store.setState((s) => ({ users: s.users.map((u) => getId(u) === userId ? { ...u, status:'online' } : u) }));
    // Re-fetch this member's timer state from DB so timerActive/workSeconds are restored
    // (user:offline previously wiped timerActive to false)
    const me = store.getState().authUser;
    if (me?.role === 'admin' || me?.role === 'manager') {
      worklogAPI.getAll({ userId, date: new Date().toISOString().split('T')[0] })
        .then(({ data }) => {
          const log = (data?.data || [])[0];
          if (log) {
            store.setState((s) => ({
              users: s.users.map((u) => getId(u) === userId ? {
                ...u,
                timerActive:       log.active,
                timerBreakActive:  log.breakActive,
                timerWorkSeconds:  log.workSeconds || 0,
                timerSessionStart: log.sessionStart,
                timerTargetSeconds:log.targetSeconds || 8 * 3600,
                timerLastUpdated:  Date.now(),
              } : u)
            }));
          }
        }).catch(() => {});
    }
  });
  sock.on('user:offline', ({ userId })          => store.setState((s) => ({ users: s.users.map((u) => getId(u) === userId ? { ...u, status:'offline', timerActive: false, timerBreakActive: false } : u) })));
  sock.on('user:status',  ({ userId, status }) => store.setState((s) => ({ users: s.users.map((u) => getId(u) === userId ? { ...u, status } : u) })));

  // User profile/role updated by admin — merge into users array for all clients
  sock.on('user:updated', (updatedUser) => {
    store.setState((s) => ({
      users: s.users.map((u) =>
        getId(u) === getId(updatedUser)
          ? { ...u, ...updatedUser }  // merge — preserves timer fields
          : u
      ),
    }));
  });

  // System settings updated — sync to all clients instantly
  sock.on('settings:updated', (settings) => {
    store.setState({ systemSettings: settings });
  });

  // Role changed — the affected user's own session gets this event
  sock.on('role:changed', ({ role }) => {
    const me = store.getState().authUser;
    if (me) {
      store.setState({ authUser: { ...me, role } });
      // Reload data so access-restricted endpoints are re-fetched with new role
      store.getState().loadAllData();
      toast.success(`Your role has been updated to ${role.charAt(0).toUpperCase() + role.slice(1)}`);
    }
  });

  sock.on('member:timer:update', (payload) => {
    store.setState((s) => ({
      users: s.users.map((u) =>
        getId(u) === payload.userId
          ? {
              ...u,
              timerActive:       payload.active       ?? u.timerActive,
              timerBreakActive:  payload.breakActive  ?? u.timerBreakActive,
              timerWorkSeconds:  payload.workSeconds  ?? u.timerWorkSeconds,
              timerSessionStart: payload.sessionStart || u.timerSessionStart,
              timerTargetSeconds:payload.targetSeconds|| u.timerTargetSeconds,
              timerLastUpdated:  Date.now(),
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
  if (_focusHandler) { window.removeEventListener('focus', _focusHandler); _focusHandler = null; }
  if (_visibilityHandler) { window.removeEventListener('visibilitychange', _visibilityHandler); _visibilityHandler = null; }
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
  services:   [],
  projects:   [],
  systemSettings: null,
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

  // ── Services ───────────────────────────────────────────────
  addService: async (body) => {
    const { data } = await servicesAPI.create(body);
    set((s) => ({ services: [...s.services, data.data] }));
    return data.data;
  },
  updateService: async (id, body) => {
    const { data } = await servicesAPI.update(id, body);
    set((s) => ({ services: s.services.map((sv) => sv._id === id ? data.data : sv) }));
  },
  deleteService: async (id) => {
    await servicesAPI.delete(id);
    set((s) => ({ services: s.services.filter((sv) => sv._id !== id) }));
  },

  // ── Projects ───────────────────────────────────────────────
  addProject: async (body) => {
    const { data } = await projectsAPI.create(body);
    set((s) => ({ projects: [...s.projects, data.data] }));
    // Increment projectCount on Client in store
    set((s) => ({
      clients: s.clients.map((c) =>
        sameId(c, body.clientId) ? { ...c, projectCount: c.projectCount + 1 } : c
      )
    }));
    return data.data;
  },
  updateProject: async (id, body) => {
    const { data } = await projectsAPI.update(id, body);
    set((s) => ({ projects: s.projects.map((p) => p._id === id ? data.data : p) }));
    return data.data;
  },
  deleteProject: async (id) => {
    const project = useAppStore.getState().projects.find((p) => p._id === id);
    await projectsAPI.delete(id);
    set((s) => ({ projects: s.projects.filter((p) => p._id !== id) }));
    if (project) {
      // Decrement projectCount on Client in store
      set((s) => ({
        clients: s.clients.map((c) =>
          sameId(c, project.clientId) ? { ...c, projectCount: c.projectCount - 1 } : c
        )
      }));
    }
  },

  // ── Settings ───────────────────────────────────────────────
  fetchSystemSettings: async () => {
    try {
      const { data } = await settingsAPI.get();
      set({ systemSettings: data.data });
      return data.data;
    } catch (err) {
      console.error('Failed to fetch system settings', err);
    }
  },
  updateSystemSettings: async (body) => {
    try {
      const { data } = await settingsAPI.update(body);
      set({ systemSettings: data.data });
      toast.success('Settings updated successfully');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update settings';
      toast.error(msg);
      throw err;
    }
  },
  inviteUser: async (body) => {
    try {
      const { data } = await settingsAPI.invite(body);
      set((s) => ({ users: [...s.users, data.data] }));
      toast.success(`Invitation sent to ${body.name}!`);
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to invite user';
      toast.error(msg);
      throw err;
    }
  },

  setActiveThread: (threadId) => {
    set({ activeThread: threadId });
    get().markThreadRead(threadId);
  },
  markThreadRead: (threadId) => {
    // Clear from localStorage so reload doesn't restore a stale count
    const uid = getId(get().authUser);
    if (uid) {
      const saved = loadUnreadLS(uid);
      if (saved[threadId]) { delete saved[threadId]; saveUnreadLS(uid, saved); }
    }
    set((s) => {
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
    });
  },

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
            breakActive: todayLog.breakActive || false,
            currentBreak: null,
            targetSeconds: todayLog.targetSeconds || (8 * 3600),
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
          active:       saved.active, // Trust localStorage
          breakActive:  saved.breakActive, // Trust localStorage
          breaks:       saved.breaks?.length > dbTimer.breaks?.length ? saved.breaks : dbTimer.breaks,
          lastTickTime: saved.active ? Date.now() : null,
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

      // Sync active state back to database if timer is restored as active
      if (timerState.active && user.role === 'member') {
        worklogAPI.setActive(true).catch(()=>{});
        worklogAPI.upsert({
          date: timerState.sessionDate || today,
          workSeconds: timerState.workSeconds,
          sessionStart: timerState.sessionStart,
          breaks: timerState.breaks,
          active: true,
          breakActive: timerState.breakActive,
          targetSeconds: timerState.targetSeconds || (8 * 3600),
        }).catch(()=>{});
      } else if (!dbTimer && user.role === 'member') {
        // If there was no DB log yet, create it so subsequent refreshes find it in the DB
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
      connectSocket(store);

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
    clearUnreadLS(getId(get().authUser));
    disconnectSocket();
    set({ _loggingOut: false, socketConnected: false, authUser:null, users:[], tasks:[], todos:[], clients:[], meetings:[], timer:initialTimer(), messages:{ channels:DEFAULT_CHANNELS, dms:[], threads:{} }, notifications: [], services: [], projects: [] });
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
            breakActive: todayLog.breakActive || false,
            currentBreak: null,
            targetSeconds: todayLog.targetSeconds || (8 * 3600),
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
          active:       saved.active, // Trust localStorage
          breakActive:  saved.breakActive, // Trust localStorage
          breaks:       saved.breaks?.length > dbTimer.breaks?.length ? saved.breaks : dbTimer.breaks,
          lastTickTime: saved.active ? Date.now() : null,
        };
      } else if (dbTimer) {
        timerState = dbTimer;
      } else if (saved && saved.sessionDate === today) {
        timerState = { ...saved, breakActive: false, currentBreak: null };
      }

      set({ authUser:user, timer:timerState });

      // Sync active state back to database if timer is restored as active
      if (timerState.active && user.role === 'member') {
        worklogAPI.setActive(true).catch(()=>{});
        worklogAPI.upsert({
          date: timerState.sessionDate || today,
          workSeconds: timerState.workSeconds,
          sessionStart: timerState.sessionStart,
          breaks: timerState.breaks,
          active: true,
          breakActive: timerState.breakActive,
          targetSeconds: timerState.targetSeconds || (8 * 3600),
        }).catch(()=>{});
      }
      await get().loadAllData();
      // Re-read from localStorage: the 401 interceptor may have silently refreshed
      // the token during authAPI.me(), making the `token` variable above stale.
      connectSocket(store);
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
      const [uR, cR, tR, dR, mR, nR, chR, svR, pR, setR] = await Promise.all([
        usersAPI.getAll(), clientsAPI.getAll(), tasksAPI.getAll(), todosAPI.getAll(), meetingsAPI.getAll(),
        notificationsAPI.getAll(), channelsAPI.getAll(), servicesAPI.getAll(), projectsAPI.getAll(),
        settingsAPI.get().catch(() => ({ data: { data: null } }))
      ]);
      const users = uR.data.data;
      const me    = get().authUser;
      // Restore persisted unread counts — prevents the badge vanishing on reload
      const savedUnread = loadUnreadLS(getId(me));
      const dms   = users
        .filter((u) => getId(u) !== getId(me))
        .map((u)   => ({ id:`dm-${getId(u)}`, userId:getId(u), unread: savedUnread[`dm-${getId(u)}`] || 0 }));
      const channels = (chR.data.data || []).map((c) => ({
        id: c._id,
        name: c.name,
        type: 'channel',
        description: c.description || '',
        isPrivate: !!c.isPrivate,
        members: c.members || [],
        unread: savedUnread[String(c._id)] || 0,
      }));
      set({
        users,
        clients:        cR.data.data,
        tasks:          tR.data.data,
        todos:          dR.data.data,
        meetings:       mR.data.data,
        notifications:  nR.data.data,
        services:       svR.data.data,
        projects:       pR.data.data || [],
        systemSettings: setR?.data?.data || null,
        messages:       { ...get().messages, dms, channels },
        loading:        false,
      });
      await get().fetchMySchedule();
      if (me?.role === 'admin' || me?.role === 'manager') {
        await get().fetchRevenueSummary();
      }
      // Hydrate team timer states from DB now that users are loaded
      // This ensures admin/manager sees accurate real-time work data
      get().fetchTeamTimerStates?.();
    } catch (err) {
      console.error('loadAllData error:', err.message);
      set({ loading:false });
    }
  },

  // ── Channels Actions ─────────────────────────────────────────
  addChannel: async (body) => {
    try {
      const { data } = await channelsAPI.create(body);
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create channel');
      throw err;
    }
  },
  updateChannel: async (id, body) => {
    try {
      const { data } = await channelsAPI.update(id, body);
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update channel');
      throw err;
    }
  },
  deleteChannel: async (id) => {
    try {
      await channelsAPI.delete(id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete channel');
      throw err;
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
      // Fetch updated projects if initial project details were provided
      try {
        const { data: pData } = await projectsAPI.getAll();
        set({ projects: pData.data || [] });
      } catch (err) {
        console.error('Failed to sync projects after client creation:', err);
      }
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
      // Don't push to store here — the backend's 'todo:created' socket event
      // will add it via the socket listener (single source of truth, no duplicates)
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
    const upd = { ...s.timer, active:true, breakActive:false, sessionDate:s.timer.sessionDate||todayStr(), sessionStart:s.timer.sessionStart||new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), lastTickTime: Date.now() };
    saveTimerLS(uid, upd);
    worklogAPI.upsert({ date:upd.sessionDate, workSeconds:upd.workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:true, breakActive:false, targetSeconds:upd.targetSeconds || (8 * 3600) }).catch(()=>{});
    worklogAPI.setActive(true).catch(()=>{});
    // Notify other sessions immediately
    sock?.emit('timer:sync', { workSeconds:upd.workSeconds, active:true, breakActive:false, sessionDate:upd.sessionDate, sessionStart:upd.sessionStart, targetSeconds:upd.targetSeconds });
    return { timer:upd };
  }),
  pauseTimer: () => set((s) => {
    const upd = { ...s.timer, active:false };
    saveTimerLS(getId(s.authUser), upd);
    worklogAPI.upsert({ date:upd.sessionDate||todayStr(), workSeconds:upd.workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:false, breakActive:false, targetSeconds:upd.targetSeconds || (8 * 3600) }).catch(()=>{});
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
    const now = Date.now();
    const lastTick = s.timer.lastTickTime || now;
    const delta = Math.max(0, Math.floor((now - lastTick) / 1000));
    
    // Capping delta at 900 seconds (15 minutes) as a safe idle fallback in case of computer sleep/hibernation,
    // while perfectly capturing background browser tabs.
    const actualDelta = delta > 0 ? Math.min(delta, 900) : 1;
    const workSeconds = s.timer.workSeconds + actualDelta;
    const upd = { ...s.timer, workSeconds, lastTickTime: now };
    const uid = getId(s.authUser);
    
    // Sync to database if we crossed a 15-second boundary
    const oldBoundary = Math.floor(s.timer.workSeconds / 15);
    const newBoundary = Math.floor(workSeconds / 15);
    if (newBoundary > oldBoundary || workSeconds % 15 === 0) {
      saveTimerLS(uid, upd);
      worklogAPI.upsert({ date:upd.sessionDate||todayStr(), workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:true, breakActive:false, targetSeconds:upd.targetSeconds || (8 * 3600) }).catch(()=>{});
    }

    // Broadcast to other sessions if we crossed a 10-second boundary
    const oldSocketBoundary = Math.floor(s.timer.workSeconds / 10);
    const newSocketBoundary = Math.floor(workSeconds / 10);
    if (newSocketBoundary > oldSocketBoundary || workSeconds % 10 === 0) {
      sock?.emit('timer:sync', { workSeconds, active:true, breakActive:false, sessionDate:upd.sessionDate, sessionStart:upd.sessionStart, targetSeconds:upd.targetSeconds });
    }
    return { timer:upd };
  }),
  startBreak: (type, totalSeconds, reason='') => set((s) => {
    const upd = { ...s.timer, active:false, breakActive:true, currentBreak:{ type, reason, totalSeconds, elapsedSeconds:0, lastBreakTickTime: Date.now() } };
    saveTimerLS(getId(s.authUser), upd);
    worklogAPI.upsert({ date:upd.sessionDate||todayStr(), workSeconds:upd.workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:false, breakActive:true, targetSeconds:upd.targetSeconds || (8 * 3600) }).catch(()=>{});
    // Notify other sessions — they should also show break state
    sock?.emit('timer:sync', { workSeconds:upd.workSeconds, active:false, breakActive:true, sessionDate:upd.sessionDate, sessionStart:upd.sessionStart, targetSeconds:upd.targetSeconds });
    return { timer:upd };
  }),
  tickBreak: () => set((s) => {
    if (!s.timer.breakActive || !s.timer.currentBreak) return {};
    const now = Date.now();
    const lastTick = s.timer.currentBreak.lastBreakTickTime || now;
    const delta = Math.max(0, Math.floor((now - lastTick) / 1000));
    const actualDelta = delta > 0 ? delta : 1;
    const elapsed = s.timer.currentBreak.elapsedSeconds + actualDelta;
    const { totalSeconds } = s.timer.currentBreak;

    if (elapsed >= totalSeconds) {
      const done = { type:s.timer.currentBreak.type, reason:s.timer.currentBreak.reason, planned:totalSeconds, actual:elapsed, endedAt:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };
      const upd  = { ...s.timer, active:true, breakActive:false, currentBreak:null, breaks:[...s.timer.breaks, done], lastTickTime: Date.now() };
      saveTimerLS(getId(s.authUser), upd);
      worklogAPI.upsert({ date:upd.sessionDate||todayStr(), workSeconds:upd.workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:true, breakActive:false, targetSeconds:upd.targetSeconds || (8 * 3600) }).catch(()=>{});
      sock?.emit('timer:sync', { workSeconds:upd.workSeconds, active:true, breakActive:false, sessionDate:upd.sessionDate, sessionStart:upd.sessionStart, targetSeconds:upd.targetSeconds });
      return { timer:upd };
    }

    const upd = { ...s.timer, currentBreak:{ ...s.timer.currentBreak, elapsedSeconds:elapsed, lastBreakTickTime: now } };
    const oldLSBoundary = Math.floor(s.timer.currentBreak.elapsedSeconds / 15);
    const newLSBoundary = Math.floor(elapsed / 15);
    if (newLSBoundary > oldLSBoundary || elapsed % 15 === 0) saveTimerLS(getId(s.authUser), upd);

    const oldSocketBoundary = Math.floor(s.timer.currentBreak.elapsedSeconds / 10);
    const newSocketBoundary = Math.floor(elapsed / 10);
    if (newSocketBoundary > oldSocketBoundary || elapsed % 10 === 0) {
      sock?.emit('timer:sync', { workSeconds:s.timer.workSeconds, active:false, breakActive:true, sessionDate:s.timer.sessionDate, sessionStart:s.timer.sessionStart, targetSeconds:s.timer.targetSeconds });
    }
    return { timer:upd };
  }),
  endBreak: () => set((s) => {
    if (!s.timer.currentBreak) return {};
    const done = { type:s.timer.currentBreak.type, reason:s.timer.currentBreak.reason, planned:s.timer.currentBreak.totalSeconds, actual:s.timer.currentBreak.elapsedSeconds, endedAt:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };
    const upd  = { ...s.timer, active:true, breakActive:false, currentBreak:null, breaks:[...s.timer.breaks, done], lastTickTime: Date.now() };
    saveTimerLS(getId(s.authUser), upd);
    worklogAPI.upsert({ date:upd.sessionDate||todayStr(), workSeconds:upd.workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:true, breakActive:false, targetSeconds:upd.targetSeconds || (8 * 3600) }).catch(()=>{});
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
              timerTargetSeconds:log.targetSeconds || 8 * 3600,
              timerLastUpdated:  Date.now(),
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