import axios from 'axios';

const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.startsWith('http')) {
    const isLocalEnv = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
    const isLocalBrowser = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173');
    
    if (!isLocalEnv || isLocalBrowser) {
      return envUrl;
    }
  }
  
  if (typeof window !== 'undefined') {
    // If in development (Vite dev server), fallback to backend port 5000
    if (window.location.port === '5173') {
      return 'http://localhost:5000/api';
    }
    // In production, dynamically use the current browser origin!
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:5000/api';
};

const BASE = getApiUrl();

export const getBackendUrl = () => {
  return BASE.endsWith('/api') ? BASE.slice(0, -4) : BASE;
};

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
    // Avoid refresh loop on /auth/refresh itself, login, or logout endpoints
    const isAuthEndpoint = orig.url?.includes('/auth/refresh') || 
                           orig.url?.includes('/auth/login') || 
                           orig.url?.includes('/auth/logout');

    // Also skip refresh if there's no token (already logged out)
    const hasToken = !!localStorage.getItem('crm_access_token');

    if (err.response?.status === 401 && !orig._retry && !isAuthEndpoint && hasToken) {
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
  getAll:               ()             => api.get('/clients'),
  getOne:               (id)           => api.get(`/clients/${id}`),
  create:               (body)         => api.post('/clients',      body),
  update:               (id, body)     => api.put(`/clients/${id}`, body),
  delete:               (id)           => api.delete(`/clients/${id}`),
  addNote:              (id, text)     => api.post(`/clients/${id}/notes`, { text }),
  resetPortalPassword:  (id, password) => api.post(`/clients/${id}/reset-portal-password`, { password }),
};

// ─────────────────────────────────────────────────────────────
// ── Tasks  (Section 5)
// ─────────────────────────────────────────────────────────────
export const tasksAPI = {
  getAll:          ()                => api.get('/tasks'),
  getByDateRange:  (start, end)      => api.get('/tasks', { params: { startDate: start, endDate: end } }),
  create:  (body)      => body instanceof FormData
    ? api.post('/tasks', body, { headers: { 'Content-Type': 'multipart/form-data' } })
    : api.post('/tasks', body),
  update:  (id, body)  => body instanceof FormData
    ? api.put(`/tasks/${id}`, body, { headers: { 'Content-Type': 'multipart/form-data' } })
    : api.put(`/tasks/${id}`, body),
  delete:  (id)        => api.delete(`/tasks/${id}`),
};

// ─────────────────────────────────────────────────────────────
// ── Todos  (Section 6)
// ─────────────────────────────────────────────────────────────
export const todosAPI = {
  getAll:          ()                => api.get('/todos'),
  getByDateRange:  (start, end)      => api.get('/todos', { params: { startDate: start, endDate: end } }),
  create:  (body)      => body instanceof FormData
    ? api.post('/todos', body, { headers: { 'Content-Type': 'multipart/form-data' } })
    : api.post('/todos', body),
  update:  (id, body)  => body instanceof FormData
    ? api.put(`/todos/${id}`, body, { headers: { 'Content-Type': 'multipart/form-data' } })
    : api.put(`/todos/${id}`, body),
  delete:  (id)        => api.delete(`/todos/${id}`),
};

// ─────────────────────────────────────────────────────────────
// ── Meetings  (Section 7)
// ─────────────────────────────────────────────────────────────
export const meetingsAPI = {
  getAll:  ()                        => api.get('/meetings'),
  create:  (body)                    => api.post('/meetings',      body),
  schedule: (body)                   => api.post('/meetings/schedule', body),
  update:  (id, body)                => api.put(`/meetings/${id}`, body),
  delete:  (id)                      => api.delete(`/meetings/${id}`),
  getMySchedule: ()                  => api.get('/meetings/my-schedule'),
  rsvp:    (invitationId, status)    => api.put(`/meetings/rsvp/${invitationId}`, { status }),
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
  react:      (id, emoji = '👍')  => api.post(`/messages/${id}/react`, { emoji }),
};

// ─────────────────────────────────────────────────────────────
// ── Revenue  (Section 9)
// ─────────────────────────────────────────────────────────────
export const revenueAPI = {
  getSummary: () => api.get('/revenue/summary'),
  record: (body) => api.post('/revenue/record', body),
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
  delete:    (id)     => api.delete(`/worklog/${id}`),
  bulkDelete: (ids)   => api.delete('/worklog/bulk', { data: { ids } }),
};

// ─────────────────────────────────────────────────────────────
// ── Notifications  (Section 11)
// ─────────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll:         (params) => api.get('/notifications', { params }),
  getUnreadCount: ()       => api.get('/notifications/unread-count'),
  markRead:       (id)     => api.patch(`/notifications/${id}/read`),
  markAllRead:    ()       => api.patch('/notifications/read-all'),
  delete:    (id) => api.delete(`/notifications/${id}`),
};

// ─────────────────────────────────────────────────────────────
// ── Services  (Section 12)
// ─────────────────────────────────────────────────────────────
export const servicesAPI = {
  getAll:  ()          => api.get('/services'),
  create:  (body)      => api.post('/services', body),
  update:  (id, body)  => api.put(`/services/${id}`, body),
  delete:  (id)        => api.delete(`/services/${id}`),
};

// ─────────────────────────────────────────────────────────────
// ── Channels
// ─────────────────────────────────────────────────────────────
export const channelsAPI = {
  getAll: () => api.get('/channels'),
  create: (body) => api.post('/channels', body),
  update: (id, body) => api.put(`/channels/${id}`, body),
  delete: (id) => api.delete(`/channels/${id}`),
};

// ─────────────────────────────────────────────────────────────
// ── Projects
// ─────────────────────────────────────────────────────────────
export const projectsAPI = {
  getAll:  ()          => api.get('/projects'),
  create:  (body)      => api.post('/projects', body),
  update:  (id, body)  => api.put(`/projects/${id}`, body),
  delete:  (id)        => api.delete(`/projects/${id}`),
};

// ─────────────────────────────────────────────────────────────
// ── Settings
// ─────────────────────────────────────────────────────────────
export const settingsAPI = {
  get:    ()          => api.get('/settings'),
  update: (body)      => api.put('/settings', body),
  invite: (body)      => api.post('/settings/users', body),
};

// ── Leads
// ─────────────────────────────────────────────────────────────
export const leadsAPI = {
  getAll: ()                      => api.get('/leads'),
  create: (body)                  => api.post('/leads', body),
  bulkCreate: (leads)             => api.post('/leads/bulk', { leads }),
  update: (id, body)              => api.put(`/leads/${id}`, body),
  delete: (id)                    => api.delete(`/leads/${id}`),
  merge:  (body)                  => api.post('/leads/merge', body),
  sendEmail: (id, subject, body)  => api.post(`/leads/${id}/email`, { subject, body }),
  getEmailLogs: (id)              => api.get(`/leads/${id}/emails`),
};

// ─────────────────────────────────────────────────────────────
// ── Audit Logs (admin only)
// ─────────────────────────────────────────────────────────────
export const auditAPI = {
  getLogs:  (params) => api.get('/audit',        { params }),
  getStats: ()       => api.get('/audit/stats'),
};

// ─────────────────────────────────────────────────────────────
// ── System / Server Logs (admin only)
// ─────────────────────────────────────────────────────────────
export const systemLogsAPI = {
  listSources:    ()                           => api.get('/admin/logs/sources'),
  getLogs:        (source, params)             => api.get(`/admin/logs/${source}`, { params }),
  getStatus:      ()                           => api.get('/admin/logs/status'),
  downloadUrl:    (source)                     => `${api.defaults.baseURL}/admin/logs/${source}/download`,
};

// ─────────────────────────────────────────────────────────────
// ── Billing & Invoicing (admin + manager only)
// ─────────────────────────────────────────────────────────────
export const billingAPI = {
  getInvoices:  (params)            => api.get('/billing/invoices', { params }),
  getInvoice:   (id)                => api.get(`/billing/invoices/${id}`),
  createInvoice:(body)              => api.post('/billing/invoices', body),
  updateInvoice:(id, body)          => api.put(`/billing/invoices/${id}`, body),
  deleteInvoice:(id)                => api.delete(`/billing/invoices/${id}`),
  pdfUrl:       (id)                => `${api.defaults.baseURL}/billing/invoices/${id}/pdf`,
  getPayments:    (invoiceId)       => api.get(`/billing/invoices/${invoiceId}/payments`),
  recordPayment:  (invoiceId, body) => body instanceof FormData
    ? api.post(`/billing/invoices/${invoiceId}/payments`, body, { headers: { 'Content-Type': 'multipart/form-data' } })
    : api.post(`/billing/invoices/${invoiceId}/payments`, body),
  updatePayment:  (id, body) => body instanceof FormData
    ? api.put(`/billing/payments/${id}`, body, { headers: { 'Content-Type': 'multipart/form-data' } })
    : api.put(`/billing/payments/${id}`, body),
  deletePayment:  (id)              => api.delete(`/billing/payments/${id}`),
  attachmentUrl:  (filePath)        => filePath
    ? api.defaults.baseURL.replace(/\/api$/, '') + filePath
    : null,
  getCollections: ()                => api.get('/billing/collections'),
  updateBillingProfile: (clientId, body) => api.put(`/billing/clients/${clientId}/billing-profile`, body),
};

// ─────────────────────────────────────────────────────────────
// ── Client Portal (role: client only)
// ─────────────────────────────────────────────────────────────
export const portalAPI = {
  overview: () => api.get('/portal/overview'),
  me:       () => api.get('/portal/me'),
  contacts: () => api.get('/portal/contacts'),
  invoices: () => api.get('/portal/invoices'),
  invoice:  (id) => api.get(`/portal/invoices/${id}`),
  pdfUrl:   (id) => `${api.defaults.baseURL}/portal/invoices/${id}/pdf`,
};