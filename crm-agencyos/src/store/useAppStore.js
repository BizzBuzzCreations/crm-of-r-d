import { create }  from 'zustand';
import { io }       from 'socket.io-client';
import toast        from 'react-hot-toast';
import {
  authAPI, usersAPI, clientsAPI, tasksAPI,
  todosAPI, meetingsAPI, messagesAPI, worklogAPI, revenueAPI,
} from '../services/api';
import { MOCK_NOTIFICATIONS } from '../mockData';

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
  return { active:false, workSeconds:0, sessionDate:null, sessionStart:null, breaks:[], breakActive:false, currentBreak:null };
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

function connectSocket(token, store) {
  if (sock?.connected) return;
  sock = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
    auth: { token },
    reconnectionAttempts: 5,
  });

  sock.on('connect',    ()    => console.log('🔌 Socket connected'));
  sock.on('disconnect', ()    => console.log('🔌 Socket disconnected'));

  // Tasks (Section 11)
  sock.on('task:created', (t) => store.setState((s) => ({ tasks: [t, ...s.tasks] })));
  sock.on('task:updated', (t) => store.setState((s) => ({ tasks: s.tasks.map((x) => getId(x) === getId(t) ? t : x) })));
  sock.on('task:deleted', (id)=> store.setState((s) => ({ tasks: s.tasks.filter((x) => getId(x) !== String(id)) })));

  // Meetings
  sock.on('meeting:created', (m) => store.setState((s) => ({ meetings: [m, ...s.meetings] })));

  // Messages
  sock.on('message:new', (msg) => store.setState((s) => {
    const tid = msg.threadId;
    const already = (s.messages.threads[tid] || []).some((x) => x._id === msg._id);
    if (already) return {};
    return { messages: { ...s.messages, threads: { ...s.messages.threads, [tid]: [...(s.messages.threads[tid] || []), msg] } } };
  }));
  sock.on('message:deleted', ({ id, threadId }) => store.setState((s) => ({
    messages: { ...s.messages, threads: { ...s.messages.threads, [threadId]: (s.messages.threads[threadId] || []).filter((m) => m._id !== id) } },
  })));

  // User presence
  sock.on('user:online',  ({ userId })         => store.setState((s) => ({ users: s.users.map((u) => getId(u) === userId ? { ...u, status:'online'  } : u) })));
  sock.on('user:offline', ({ userId })          => store.setState((s) => ({ users: s.users.map((u) => getId(u) === userId ? { ...u, status:'offline' } : u) })));
  sock.on('user:status',  ({ userId, status }) => store.setState((s) => ({ users: s.users.map((u) => getId(u) === userId ? { ...u, status } : u) })));
}

function disconnectSocket() {
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
  notifications: MOCK_NOTIFICATIONS,
  timer:      initialTimer(),
  sidebarOpen:true,
  darkMode:   false,
  loading:    false,
  _loggingOut:false,

  // ── UI ─────────────────────────────────────────────────────
  toggleSidebar:  () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => { const n=!s.darkMode; document.documentElement.classList.toggle('dark',n); return { darkMode:n }; }),
  markAllRead: () => set((s) => ({
    notifications: s.notifications.map((n) => ({ ...n, unread: false }))
  })),
  dismissNotification: (id) => set((s) => ({
    notifications: s.notifications.filter((n) => n.id !== id)
  })),

  // ══════════════════════════════════════════════════════════
  // AUTH
  // ══════════════════════════════════════════════════════════
  login: async (email, password) => {
    try {
      const { data } = await authAPI.login({ email, password });
      localStorage.setItem('crm_access_token', data.accessToken);
      const user = data.user;

      // Timer: restore same-day or start fresh
      const saved = loadTimerLS(getId(user));
      const today = todayStr();
      const timerState = saved && saved.sessionDate === today
        ? { ...saved, breakActive:false, currentBreak:null }
        : { ...initialTimer(), active:true, sessionDate:today, sessionStart:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };

      set({ authUser:user, timer:timerState, loading:false });
      saveTimerLS(getId(user), timerState);

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
    set({ _loggingOut: false, authUser:null, users:[], tasks:[], todos:[], clients:[], meetings:[], timer:initialTimer(), messages:{ channels:DEFAULT_CHANNELS, dms:[], threads:{} }, notifications: MOCK_NOTIFICATIONS });
  },

  // Restore session on page reload using stored token
  restoreSession: async () => {
    const token = localStorage.getItem('crm_access_token');
    if (!token) return false;
    try {
      const { data } = await authAPI.me();
      const user = data.user;
      const saved = loadTimerLS(getId(user));
      const today = todayStr();
      const timerState = saved && saved.sessionDate === today
        ? { ...saved, breakActive:false, currentBreak:null }
        : initialTimer();
      set({ authUser:user, timer:timerState });
      await get().loadAllData();
      connectSocket(token, store);
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
      const [uR, cR, tR, dR, mR] = await Promise.all([
        usersAPI.getAll(), clientsAPI.getAll(), tasksAPI.getAll(), todosAPI.getAll(), meetingsAPI.getAll(),
      ]);
      const users = uR.data.data;
      const me    = get().authUser;
      const dms   = users
        .filter((u) => getId(u) !== getId(me))
        .map((u)   => ({ id:`dm-${getId(u)}`, userId:getId(u), unread:0 }));
      set({
        users,
        clients:  cR.data.data,
        tasks:    tR.data.data,
        todos:    dR.data.data,
        meetings: mR.data.data,
        messages: { ...get().messages, dms },
        loading:  false,
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
    try {
      const { data } = await tasksAPI.update(id, body);
      return data.data;
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update task'); throw err; }
  },
  moveTask: async (id, status) => {
    return get().updateTask(id, { status, progress: status==='completed'?100:undefined });
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
      set((s) => ({ messages: { ...s.messages, threads: { ...s.messages.threads, [threadId]: data.data } } }));
      sock?.emit('join:thread', threadId);
    } catch {}
  },
  leaveThread: (threadId) => { sock?.emit('leave:thread', threadId); },

  sendMessage: async (threadId, text, attachments = []) => {
    if (!text?.trim() && attachments.length === 0) return;
    try {
      if (attachments.length > 0) {
        const fd = new FormData();
        if (text?.trim()) fd.append('text', text.trim());
        attachments.forEach((a) => a.file && fd.append('files', a.file));
        await messagesAPI.sendFiles(threadId, fd);
      } else {
        await messagesAPI.send(threadId, text.trim());
      }
      // Socket message:new will update state
    } catch (err) { toast.error('Failed to send message'); }
  },
  deleteMessage: async (threadId, msgId) => {
    try {
      await messagesAPI.delete(msgId);
      // Socket message:deleted will update state
    } catch { toast.error('Failed to delete message'); }
  },

  // Typing indicators (Section 11)
  emitTypingStart: (threadId) => sock?.emit('typing:start', { threadId }),
  emitTypingStop:  (threadId) => sock?.emit('typing:stop',  { threadId }),
  onTypingStart: (cb) => { sock?.on('typing:start', cb); return () => sock?.off('typing:start', cb); },
  onTypingStop:  (cb) => { sock?.on('typing:stop',  cb); return () => sock?.off('typing:stop',  cb); },

  // ══════════════════════════════════════════════════════════
  // WORK TIMER  (local tick → syncs to POST /api/worklog every 5min)
  // ══════════════════════════════════════════════════════════
  startTimer: () => set((s) => {
    const uid = getId(s.authUser);
    const upd = { ...s.timer, active:true, breakActive:false, sessionDate:s.timer.sessionDate||todayStr(), sessionStart:s.timer.sessionStart||new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };
    saveTimerLS(uid, upd);
    worklogAPI.setActive(true).catch(()=>{});
    return { timer:upd };
  }),
  pauseTimer: () => set((s) => {
    const upd = { ...s.timer, active:false };
    saveTimerLS(getId(s.authUser), upd);
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
      // Sync to backend every 5 min (POST /api/worklog)
      if (workSeconds % 300 === 0) {
        worklogAPI.upsert({ date:upd.sessionDate||todayStr(), workSeconds, sessionStart:upd.sessionStart, breaks:upd.breaks, active:true }).catch(()=>{});
      }
    }
    return { timer:upd };
  }),
  startBreak: (type, totalSeconds, reason='') => set((s) => {
    const upd = { ...s.timer, active:false, breakActive:true, currentBreak:{ type, reason, totalSeconds, elapsedSeconds:0 } };
    saveTimerLS(getId(s.authUser), upd);
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
      return { timer:upd };
    }
    const upd = { ...s.timer, currentBreak:{ ...s.timer.currentBreak, elapsedSeconds:elapsed } };
    if (elapsed % 15 === 0) saveTimerLS(getId(s.authUser), upd);
    return { timer:upd };
  }),
  endBreak: () => set((s) => {
    if (!s.timer.currentBreak) return {};
    const done = { type:s.timer.currentBreak.type, reason:s.timer.currentBreak.reason, planned:s.timer.currentBreak.totalSeconds, actual:s.timer.currentBreak.elapsedSeconds, endedAt:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };
    const upd  = { ...s.timer, active:true, breakActive:false, currentBreak:null, breaks:[...s.timer.breaks, done] };
    saveTimerLS(getId(s.authUser), upd);
    return { timer:upd };
  }),

  // ── WorkLog reader (GET /api/worklog) ─────────────────────
  getWorkLog: (userId) => loadWorkLogLS(userId),   // local cache
  fetchWorkLog: async (params) => {
    try {
      const { data } = await worklogAPI.getAll(params);
      return data.data;
    } catch { return []; }
  },
}));

export default useAppStore;