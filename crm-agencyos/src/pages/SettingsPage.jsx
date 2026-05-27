import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Download, AlertTriangle, RefreshCw, Save, Lock, User, Bell, Database, Clock, Layers, Plus, Trash2, X, Edit2, Zap, Palette, Smartphone, Globe, BarChart3, PenTool, Clapperboard, Camera, Wrench, Lightbulb, Shield, Rocket } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/shallow';
import { Page, Avatar, Toggle, Button } from '../components/ui';
import { cn, getId, sameId, canManage, ROLE_CONFIG, fmtTimer } from '../utils/helpers';

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(ds) {
  if (!ds) return '—';
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function breakTotal(breaks, type) {
  if (!breaks?.length) return 0;
  return breaks.filter((b) => b.type === type).reduce((a, b) => a + (b.actual || b.planned || 0), 0);
}

function downloadCSV(rows, filename) {
  const csv  = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Left nav tabs ─────────────────────────────────────────────
const TABS = [
  { id: 'profile',       label: 'Profile',        icon: User     },
  { id: 'security',      label: 'Security',       icon: Lock     },
  { id: 'notifications', label: 'Notifications',  icon: Bell     },
  { id: 'services',      label: 'Services',       icon: Layers   },
  { id: 'data',          label: 'Data & Export',  icon: Database },
  { id: 'worklog',       label: 'Work Hours Log', icon: Clock    },
];

const NOTIF_PREFS = [
  { key: 'task_assigned',    label: 'Task Assigned',       desc: 'When a new task is assigned to you' },
  { key: 'task_approved',    label: 'Task Approved',       desc: 'When your submitted task is approved' },
  { key: 'meeting_reminder', label: 'Meeting Reminder',    desc: '15 minutes before a meeting starts' },
  { key: 'client_update',    label: 'Client Updates',      desc: 'New notes or status changes on clients' },
  { key: 'message_dm',       label: 'Direct Messages',     desc: 'When you receive a direct message' },
  { key: 'weekly_report',    label: 'Weekly Report Email', desc: 'Every Monday with your performance summary' },
];

// ─────────────────────────────────────────────────────────────
// Profile section
// ─────────────────────────────────────────────────────────────
function ProfileSection({ user }) {
  const { register, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: {
      name:  user?.name  || '',
      email: user?.email || '',
    },
  });

  const roleCfg = ROLE_CONFIG[user?.role] || {};
  const joinDate = user?.joinDate
    ? new Date(user.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const onSubmit = () => toast.success('Profile updated!');

  return (
    <div>
      <h2 className="text-[18px] font-bold text-slate-900 dark:text-white pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
        Profile Information
      </h2>

      {/* User card */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[22px] font-bold flex-shrink-0"
          style={{ background: user?.color || '#6366f1' }}
        >
          {user?.name?.[0] || 'U'}
        </div>
        <div>
          <p className="text-[18px] font-bold text-slate-900 dark:text-white">{user?.name}</p>
          <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="capitalize">{user?.role}</span>
            {' · '}Member since {joinDate}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-[14px] font-semibold text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
            <input
              className="form-input text-[14px] py-2.5"
              {...register('name')}
            />
          </div>
          <div>
            <label className="block text-[14px] font-semibold text-slate-700 dark:text-slate-300 mb-2">Email</label>
            <input
              className="form-input text-[14px] py-2.5"
              type="email"
              {...register('email')}
            />
          </div>
        </div>
        <Button variant="primary" type="submit">
          <Save size={14} /> Save Changes
        </Button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Security section
// ─────────────────────────────────────────────────────────────
function SecuritySection() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { currentPwd: '', newPwd: '', confirmPwd: '' },
  });
  const changePassword = useAppStore((s) => s.changePassword);

  const onSubmit = async (data) => {
    if (data.newPwd !== data.confirmPwd) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await changePassword(data.currentPwd, data.newPwd);
      if (res.success) {
        reset();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-[18px] font-bold text-slate-900 dark:text-white pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
        Change Password
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-xl">
        <div>
          <label className="block text-[14px] font-semibold text-slate-700 dark:text-slate-300 mb-2">Current Password</label>
          <input
            type="password"
            className="form-input text-[14px] py-2.5"
            placeholder="Enter current password"
            {...register('currentPwd', { required: true })}
          />
        </div>

        <div>
          <label className="block text-[14px] font-semibold text-slate-700 dark:text-slate-300 mb-2">New Password</label>
          <input
            type="password"
            className="form-input text-[14px] py-2.5"
            placeholder="Minimum 6 characters"
            {...register('newPwd', { required: true, minLength: 6 })}
          />
        </div>

        <div>
          <label className="block text-[14px] font-semibold text-slate-700 dark:text-slate-300 mb-2">Confirm New Password</label>
          <input
            type="password"
            className="form-input text-[14px] py-2.5"
            placeholder="Repeat new password"
            {...register('confirmPwd', { required: true })}
          />
        </div>

        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? (
            <RefreshCw size={14} className="animate-spin mr-1.5" />
          ) : (
            <Lock size={14} className="mr-1.5" />
          )}
          {loading ? 'Updating…' : 'Update Password'}
        </Button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Notifications section
// ─────────────────────────────────────────────────────────────
function NotificationsSection() {
  const [notifs, setNotifs] = useState({
    task_assigned: true, task_approved: true, meeting_reminder: true,
    client_update: false, message_dm: true, weekly_report: false,
  });
  return (
    <div>
      <h2 className="text-[18px] font-bold text-slate-900 dark:text-white pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
        Notification Preferences
      </h2>
      <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-w-xl">
        {NOTIF_PREFS.map((n) => (
          <Toggle
            key={n.key}
            label={n.label}
            description={n.desc}
            checked={notifs[n.key]}
            onChange={(v) => setNotifs((s) => ({ ...s, [n.key]: v }))}
          />
        ))}
      </div>
      <div className="mt-6">
        <Button variant="primary" onClick={() => toast.success('Preferences saved!')}>
          <Save size={14} /> Save Preferences
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Data & Export section  (matches Image 3 exactly)
// ─────────────────────────────────────────────────────────────
function DataSection() {
  const { tasks, todos, clients } = useAppStore(useShallow((s) => ({
    tasks: s.tasks, todos: s.todos, clients: s.clients,
  })));

  const today = new Date().toISOString().split('T')[0];

  const handleExportTasks = () => {
    const rows = [
      ['Title','Assigned To','Status','Priority','Due Date','Created','Type'],
      ...tasks.map((t) => [t.title, String(t.assignedTo), t.status, t.priority, t.dueDate||'', t.createdAt||'', t.type]),
    ];
    downloadCSV(rows, `tasks-${today}.csv`);
    toast.success('Tasks exported!');
  };

  const handleExportTodos = () => {
    const rows = [
      ['Title','User ID','Status','Priority','ETA','Created'],
      ...todos.map((t) => [t.title, String(t.userId), t.status, t.priority, t.eta||'', t.createdAt||'']),
    ];
    downloadCSV(rows, `todos-${today}.csv`);
    toast.success('Todos exported!');
  };

  const handleExportClients = () => {
    const rows = [
      ['Name','Contact','Email','Phone','Industry','Status','Payment','Budget'],
      ...clients.map((c) => [c.name, c.contact, c.email, c.phone, c.industry, c.status, c.paymentStatus, c.budget]),
    ];
    downloadCSV(rows, `clients-${today}.csv`);
    toast.success('Clients exported!');
  };

  const handleFullBackup = () => {
    downloadJSON({ tasks, todos, clients, exported: today }, `agencyos-backup-${today}.json`);
    toast.success('Full backup downloaded!');
  };

  const handleReset = () => {
    if (window.confirm('⚠️ This will delete ALL CRM data. Are you absolutely sure?')) {
      localStorage.clear();
      toast.success('All data reset. Refreshing…');
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  const ExportRow = ({ title, description, label, variant = 'outline', onClick }) => (
    <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0">
      <div>
        <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-200">{title}</p>
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={onClick}
        className={cn(
          'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold border transition-all',
          variant === 'danger'
            ? 'bg-red-500 hover:bg-red-600 text-white border-red-500'
            : 'bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
        )}
      >
        <Download size={13} /> {label}
      </button>
    </div>
  );

  return (
    <div>
      {/* Export section */}
      <h2 className="text-[18px] font-bold text-slate-900 dark:text-white pb-4 border-b border-slate-200 dark:border-slate-700 mb-2">
        Export Data
      </h2>
      <div className="mb-8">
        <ExportRow title="Export All Tasks"   description="Download all tasks as CSV"        label="↓ Export" onClick={handleExportTasks} />
        <ExportRow title="Export All Todos"   description="Download all todos as CSV"        label="↓ Export" onClick={handleExportTodos} />
        <ExportRow title="Export Clients"     description="Download all client data"         label="↓ Export" onClick={handleExportClients} />
        <ExportRow title="Export Full Backup" description="All data in JSON format"          label="↓ Backup" onClick={handleFullBackup} />
      </div>

      {/* Danger zone */}
      <h2 className="text-[18px] font-bold text-red-500 pb-4 border-b border-red-200 dark:border-red-800/40 mb-2">
        Danger Zone
      </h2>
      <div className="flex items-center justify-between py-4">
        <div>
          <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-200">Reset All CRM Data</p>
          <p className="text-[12.5px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
            <AlertTriangle size={11} /> This will delete ALL data and cannot be undone
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Work Hours Log section (matches Image 4 exactly)
// ─────────────────────────────────────────────────────────────
function WorkLogSection({ authUser, users }) {
  const isManager   = canManage(authUser?.role);
  const [filterUser, setFilterUser] = useState('all');
  const fetchWorkLog = useAppStore((s) => s.fetchWorkLog);
  const [dbLogs, setDbLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchWorkLog();
        if (active) setDbLogs(data || []);
      } catch (err) {
        console.error('Failed to fetch work logs from backend', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [fetchWorkLog]);

  // Build rows from database work logs
  const allRows = useMemo(() => {
    const rows = [];
    dbLogs.forEach((log) => {
      const u = users.find((usr) => sameId(usr, log.userId));
      if (!u) return;

      if (!isManager && !sameId(u, authUser)) return;

      rows.push({
        user:          u,
        date:          log.date,
        workSeconds:   log.workSeconds || 0,
        breaks:        log.breaks || [],
        isToday:       log.date === new Date().toISOString().split('T')[0],
        targetSeconds: log.targetSeconds || (9 * 3600),
      });
    });

    // Sort: active today first, then by date desc
    return rows.sort((a, b) => {
      if (a.isToday && !b.isToday) return -1;
      if (!a.isToday && b.isToday) return 1;
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [dbLogs, users, authUser, isManager]);

  const filtered = useMemo(() => {
    if (!isManager || filterUser === 'all') return allRows;
    return allRows.filter((r) => getId(r.user) === filterUser);
  }, [allRows, filterUser, isManager]);

  return (
    <div>
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700 mb-5">
        <h2 className="text-[18px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock size={18} className="text-slate-500" /> Work Hours Log
        </h2>
        {isManager && (
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <span className="font-medium">Viewing:</span>
            <select
              className="form-input w-[160px] py-1.5 text-[13px]"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            >
              <option value="all">All Members</option>
              {users.map((u) => (
                <option key={getId(u)} value={getId(u)}>{u.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <Clock size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-[14px] font-semibold">No work log entries yet</p>
          <p className="text-[12px] mt-0.5">Entries appear once the work timer has been used</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                {['Member','Date','Time Worked','Lunch Used','Tea Used','Custom Break','Status'].map((h) => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 pb-3 pr-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isActive   = sameId(row.user, authUser) && row.isToday;
                const target     = row.targetSeconds || (9 * 3600);
                const pct        = Math.min(100, (row.workSeconds / target) * 100);
                const lunchSecs  = breakTotal(row.breaks, 'lunch');
                const teaSecs    = breakTotal(row.breaks, 'tea');
                const customSecs = breakTotal(row.breaks, 'custom');

                return (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    {/* Member */}
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                          style={{ background: row.user.color || '#6366f1' }}
                        >
                          {row.user.name?.[0]}
                        </div>
                        <span className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">{row.user.name}</span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 pr-4 text-[13px] text-slate-600 dark:text-slate-400">
                      {fmtDate(row.date)}
                    </td>

                    {/* Time worked with progress bar */}
                    <td className="py-3.5 pr-6">
                      <div className="flex items-center gap-3 min-w-[180px]">
                        {/* Progress bar */}
                        <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: pct >= 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                        <span className="font-mono text-[13.5px] font-bold text-slate-800 dark:text-slate-200">
                          {fmtTimer(row.workSeconds)}
                        </span>
                      </div>
                    </td>

                    {/* Lunch */}
                    <td className="py-3.5 pr-4">
                      <span className={cn('font-mono text-[13px]', lunchSecs > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400')}>
                        {fmtTimer(lunchSecs)}
                      </span>
                    </td>

                    {/* Tea */}
                    <td className="py-3.5 pr-4">
                      <span className={cn('font-mono text-[13px]', teaSecs > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-400')}>
                        {fmtTimer(teaSecs)}
                      </span>
                    </td>

                    {/* Custom break */}
                    <td className="py-3.5 pr-4">
                      {customSecs > 0 ? (
                        <span className="font-mono text-[13px] text-indigo-600 font-semibold">{fmtTimer(customSecs)}</span>
                      ) : (
                        <span className="text-[13px] text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold',
                        isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                      )}>
                        <span className={cn('w-2 h-2 rounded-full', isActive ? 'bg-emerald-500' : 'bg-slate-400')} />
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Services section
// ─────────────────────────────────────────────────────────────
const COLOR_SWATCHES = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#64748b', '#1e293b',
];

const PRESET_ICONS = ['⚡', '🎨', '📱', '🌐', '📊', '✍️', '🎬', '📸', '🔧', '💡', '🛡️', '🚀'];

const SERVICE_ICON_MAP = {
  '⚡': Zap,
  '🎨': Palette,
  '📱': Smartphone,
  '🌐': Globe,
  '📊': BarChart3,
  '✍️': PenTool,
  '🎬': Clapperboard,
  '📸': Camera,
  '🔧': Wrench,
  '💡': Lightbulb,
  '🛡️': Shield,
  '🚀': Rocket
};

function AddServiceModal({ onClose, onSave }) {
  const [name, setName]       = useState('');
  const [desc, setDesc]       = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor]     = useState('#6366f1');
  const [icon, setIcon]       = useState('⚡');
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Service name is required'); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: desc.trim(), category: category.trim() || 'General', color, icon });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-[16px] font-bold text-slate-900 dark:text-white">Add New Service</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Preview card */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '22' }}>
              {(() => {
                const IconComponent = SERVICE_ICON_MAP[icon] || Zap;
                return <IconComponent size={20} style={{ color }} />;
              })()}
            </div>
            <div>
              <p className="text-[14px] font-semibold text-slate-900 dark:text-white">{name || 'Service Name'}</p>
              <p className="text-[12px] text-slate-400">{category || 'General'}</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Name *</label>
            <input
              className="form-input text-[14px] py-2"
              placeholder="e.g. Social Media Management"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
            <textarea
              className="form-input text-[14px] py-2 resize-none"
              rows={2}
              placeholder="Brief description of this service…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
            <input
              className="form-input text-[14px] py-2"
              placeholder="e.g. Marketing, Design, Development"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          {/* Icon picker */}
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ICONS.map((ic) => {
                const IconComponent = SERVICE_ICON_MAP[ic] || Zap;
                const isSelected = icon === ic;
                return (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-all',
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-transparent hover:border-slate-300 bg-slate-100 dark:bg-slate-700'
                    )}
                  >
                    <IconComponent size={16} className={isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-550 dark:text-slate-300'} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-full border-2 transition-all',
                    color === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent hover:scale-105'
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : <><Plus size={14} /> Add Service</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ServicesSection() {
  const { services, addService, deleteService, authUser } = useAppStore(
    useShallow((s) => ({ services: s.services, addService: s.addService, deleteService: s.deleteService, authUser: s.authUser }))
  );
  const isAdmin = authUser?.role === 'admin';
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteService(id);
      toast.success('Service removed');
    } catch {
      toast.error('Failed to delete service');
    } finally {
      setDeletingId(null);
    }
  };

  const grouped = services.reduce((acc, sv) => {
    const cat = sv.category || 'General';
    (acc[cat] = acc[cat] || []).push(sv);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
        <div>
          <h2 className="text-[18px] font-bold text-slate-900 dark:text-white">Services</h2>
          
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Add Service
          </Button>
        )}
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4">
            <Layers size={24} className="text-indigo-400" />
          </div>
          <p className="text-[15px] font-semibold text-slate-700 dark:text-slate-300">No services yet</p>
          {isAdmin && (
            <p className="text-[13px] text-slate-400 mt-1">Add your first service to get started</p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">{cat}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((sv) => (
                  <div
                    key={sv._id}
                    className="group relative flex items-start gap-3.5 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 hover:border-indigo-200 dark:hover:border-indigo-700 transition-all"
                  >
                    {/* Color accent bar */}
                    <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ background: sv.color }} />

                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: sv.color + '22' }}
                    >
                      {(() => {
                        const IconComponent = SERVICE_ICON_MAP[sv.icon] || Zap;
                        return <IconComponent size={20} style={{ color: sv.color }} />;
                      })()}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">{sv.name}</p>
                      {sv.description && (
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{sv.description}</p>
                      )}
                    </div>

                    {/* Delete — admin only, visible on hover */}
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(sv._id)}
                        disabled={deletingId === sv._id}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                      >
                        {deletingId === sv._id
                          ? <RefreshCw size={13} className="animate-spin" />
                          : <Trash2 size={13} />
                        }
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddServiceModal
          onClose={() => setShowModal(false)}
          onSave={async (body) => { await addService(body); toast.success('Service added!'); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Settings Page
// ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const authUser = useAppStore((s) => s.authUser);
  const users    = useAppStore((s) => s.users);

  const role      = authUser?.role;
  const isMember  = role === 'member';

  // Default to 'worklog' for members (timer feature), 'profile' for others
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <Page>
      <div className="mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Manage your account and workspace preferences</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Left nav ── */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-2 shadow-card">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium transition-all text-left mb-0.5 last:mb-0',
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  )}
                >
                  <tab.icon
                    size={15}
                    className={cn('flex-shrink-0', isActive ? 'text-indigo-500' : 'text-slate-400')}
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right content panel ── */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-7 shadow-card min-h-[400px]">
          {activeTab === 'profile'       && <ProfileSection       user={authUser} />}
          {activeTab === 'security'      && <SecuritySection />}
          {activeTab === 'notifications' && <NotificationsSection />}
          {activeTab === 'services'      && <ServicesSection />}
          {activeTab === 'data'          && <DataSection />}
          {activeTab === 'worklog'       && <WorkLogSection authUser={authUser} users={users} />}
        </div>
      </div>
    </Page>
  );
}