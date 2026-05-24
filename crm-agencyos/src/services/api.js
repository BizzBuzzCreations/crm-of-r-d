import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Axios instance ────────────────────────────────────────────
const api = axios.create({
  baseURL:         BASE,
  withCredentials: true,          // send cookies (refresh token)
  headers:         { 'Content-Type': 'application/json' },
  timeout:         15000,
});

// ── Request: attach access token ─────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('crm_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: auto-refresh on 401 ────────────────────────────
let refreshing = false;
let queue      = [];

const processQueue = (err, token = null) => {
  queue.forEach((p) => (err ? p.reject(err) : p.resolve(token)));
  queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const orig = err.config;
    // Avoid refresh loop on /auth/refresh itself
    if (err.response?.status === 401 && !orig._retry && !orig.url?.includes('/auth/refresh')) {
      if (refreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject }))
          .then((token) => { orig.headers.Authorization = `Bearer ${token}`; return api(orig); });
      }
      orig._retry = true;
      refreshing  = true;
      try {
        const { data } = await axios.post(`${BASE}/auth/refresh`, {}, { withCredentials: true });
        const token    = data.accessToken;
        localStorage.setItem('crm_access_token', token);
        api.defaults.headers.Authorization = `Bearer ${token}`;
        processQueue(null, token);
        orig.headers.Authorization = `Bearer ${token}`;
        return api(orig);
      } catch (e) {
        processQueue(e, null);
        localStorage.removeItem('crm_access_token');
        window.dispatchEvent(new Event('crm:logout'));
        return Promise.reject(e);
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ─────────────────────────────────────────────────────────────
// ── Auth  (Section 2)
// ─────────────────────────────────────────────────────────────
export const authAPI = {
  login:          (body)  => api.post('/auth/login',    body),
  logout:         ()      => api.post('/auth/logout'),
  refresh:        ()      => api.post('/auth/refresh'),
  me:             ()      => api.get('/auth/me'),
  updateProfile:  (body)  => api.put('/auth/profile',   body),
  changePassword: (body)  => api.put('/auth/password',  body),
};

// ─────────────────────────────────────────────────────────────
// ── Users  (Section 3)
// ─────────────────────────────────────────────────────────────
export const usersAPI = {
  getAll:  ()          => api.get('/users'),
  create:  (body)      => api.post('/users',      body),
  update:  (id, body)  => api.put(`/users/${id}`, body),
  delete:  (id)        => api.delete(`/users/${id}`),
};

// ─────────────────────────────────────────────────────────────
// ── Clients  (Section 4)
// ─────────────────────────────────────────────────────────────
export const clientsAPI = {
  getAll:  ()          => api.get('/clients'),
  getOne:  (id)        => api.get(`/clients/${id}`),
  create:  (body)      => api.post('/clients',      body),
  update:  (id, body)  => api.put(`/clients/${id}`, body),
  delete:  (id)        => api.delete(`/clients/${id}`),
  addNote: (id, text)  => api.post(`/clients/${id}/notes`, { text }),
};

// ─────────────────────────────────────────────────────────────
// ── Tasks  (Section 5)
// ─────────────────────────────────────────────────────────────
export const tasksAPI = {
  getAll:  ()          => api.get('/tasks'),
  create:  (body)      => api.post('/tasks',      body),
  update:  (id, body)  => api.put(`/tasks/${id}`, body),
  delete:  (id)        => api.delete(`/tasks/${id}`),
};

// ─────────────────────────────────────────────────────────────
// ── Todos  (Section 6)
// ─────────────────────────────────────────────────────────────
export const todosAPI = {
  getAll:  ()          => api.get('/todos'),
  create:  (body)      => api.post('/todos',      body),
  update:  (id, body)  => api.put(`/todos/${id}`, body),
  delete:  (id)        => api.delete(`/todos/${id}`),
};

// ─────────────────────────────────────────────────────────────
// ── Meetings  (Section 7)
// ─────────────────────────────────────────────────────────────
export const meetingsAPI = {
  getAll:  ()          => api.get('/meetings'),
  create:  (body)      => api.post('/meetings',      body),
  update:  (id, body)  => api.put(`/meetings/${id}`, body),
  delete:  (id)        => api.delete(`/meetings/${id}`),
};

// ─────────────────────────────────────────────────────────────
// ── Messages  (Section 8)
// ─────────────────────────────────────────────────────────────
export const messagesAPI = {
  getThread:  (threadId)          => api.get(`/messages/${threadId}`),
  // text-only message
  send:       (threadId, text)    => api.post(`/messages/${threadId}`, { text }),
  // with file attachments — multipart/form-data
  sendFiles:  (threadId, fd)      => api.post(`/messages/${threadId}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete:     (id)                => api.delete(`/messages/${id}`),
};

// ─────────────────────────────────────────────────────────────
// ── Reports  (Section 9)
// ─────────────────────────────────────────────────────────────
export const reportsAPI = {
  // params: { period, userId, from, to }
  get: (params) => api.get('/reports', { params }),
};

// ─────────────────────────────────────────────────────────────
// ── Work Log  (Section 10)
// ─────────────────────────────────────────────────────────────
export const worklogAPI = {
  // params: { userId }
  getAll:    (params) => api.get('/worklog',        { params }),
  upsert:    (body)   => api.post('/worklog',        body),
  setActive: (active) => api.patch('/worklog/active', { active }),
};