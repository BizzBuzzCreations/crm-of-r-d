import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, Bell, Sun, Moon, Settings, LogOut, User, ChevronDown, CheckCheck, X } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { Avatar, Badge } from '../components/ui';
import { cn, ROLE_CONFIG } from '../utils/helpers';

export default function Navbar() {
  const navigate = useNavigate();
  const {
    authUser, sidebarOpen, toggleSidebar, darkMode, toggleDarkMode,
    notifications, markAllRead, dismissNotification, logout,
    tasks, clients, meetings,
  } = useAppStore();

  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);

  const unread = notifications.filter((n) => n.unread).length;

  // Close on outside click
  const notifRef   = useRef(null);
  const profileRef = useRef(null);
  const searchRef  = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target))   setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
      if (searchRef.current && !searchRef.current.contains(e.target))   setShowResults(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return null;

    const filteredTasks = tasks.filter(t => 
      t.title?.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query) ||
      t.tags?.some(tag => tag.toLowerCase().includes(query))
    ).slice(0, 5);

    const filteredClients = clients.filter(c =>
      c.name?.toLowerCase().includes(query) ||
      c.contact?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.industry?.toLowerCase().includes(query)
    ).slice(0, 5);

    const filteredMeetings = meetings.filter(m =>
      m.title?.toLowerCase().includes(query) ||
      m.description?.toLowerCase().includes(query) ||
      m.location?.toLowerCase().includes(query)
    ).slice(0, 5);

    const total = filteredTasks.length + filteredClients.length + filteredMeetings.length;

    return {
      tasks: filteredTasks,
      clients: filteredClients,
      meetings: filteredMeetings,
      total
    };
  }, [search, tasks, clients, meetings]);

  const notifIconMap = {
    task:    { bg: 'bg-indigo-100', color: 'text-indigo-600', icon: '✓' },
    meeting: { bg: 'bg-amber-100',  color: 'text-amber-600',  icon: '📅' },
    client:  { bg: 'bg-emerald-100',color: 'text-emerald-600',icon: '🏢' },
    system:  { bg: 'bg-slate-100',  color: 'text-slate-600',  icon: 'ℹ' },
  };

  const roleCfg = ROLE_CONFIG[authUser?.role] || {};

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-5 flex-shrink-0 z-30">
      {/* Toggle */}
      <button
        onClick={toggleSidebar}
        className="btn-icon text-slate-500 dark:text-slate-400"
      >
        <Menu size={18} />
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-[380px]" ref={searchRef}>
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search tasks, clients, meetings…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          className="w-full pl-9 pr-8 py-1.5 text-[13px] bg-slate-100 dark:bg-slate-800 border border-transparent rounded-lg text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none focus:bg-white dark:focus:bg-slate-700 focus:border-primary-400 transition-all"
        />
        {search && (
          <button 
            onClick={() => { setSearch(''); setShowResults(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-650 dark:hover:text-slate-200"
          >
            <X size={13} />
          </button>
        )}

        {/* Floating Search Results */}
        <AnimatePresence>
          {showResults && searchResults && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute left-0 right-0 top-[calc(100%+8px)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-modal max-h-[380px] overflow-y-auto z-50 p-2"
            >
              {searchResults.total === 0 ? (
                <div className="py-8 text-center text-slate-400 text-[12.5px]">
                  No results found for "{search}"
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Clients */}
                  {searchResults.clients.length > 0 && (
                    <div>
                      <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Clients</div>
                      <div className="space-y-0.5 mt-1">
                        {searchResults.clients.map(c => (
                          <button
                            key={c._id || c.id}
                            onClick={() => {
                              navigate('/clients');
                              setSearch('');
                              setShowResults(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 flex justify-between items-center transition-colors"
                          >
                            <span className="font-medium truncate">{c.name}</span>
                            <span className="text-[11px] text-slate-400 italic">{c.industry || 'Client'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks */}
                  {searchResults.tasks.length > 0 && (
                    <div>
                      <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tasks</div>
                      <div className="space-y-0.5 mt-1">
                        {searchResults.tasks.map(t => (
                          <button
                            key={t._id || t.id}
                            onClick={() => {
                              navigate('/tasks');
                              setSearch('');
                              setShowResults(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 flex justify-between items-center transition-colors"
                          >
                            <span className="font-medium truncate">{t.title}</span>
                            <span className={cn(
                              "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                              t.status === 'completed' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                            )}>{t.status}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meetings */}
                  {searchResults.meetings.length > 0 && (
                    <div>
                      <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Meetings</div>
                      <div className="space-y-0.5 mt-1">
                        {searchResults.meetings.map(m => (
                          <button
                            key={m._id || m.id}
                            onClick={() => {
                              navigate('/meetings');
                              setSearch('');
                              setShowResults(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 flex justify-between items-center transition-colors"
                          >
                            <span className="font-medium truncate">{m.title}</span>
                            <span className="text-[10.5px] text-slate-400">{m.date}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {/* Dark mode */}
        <button onClick={toggleDarkMode} className="btn-icon">
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotif((s) => !s); setShowProfile(false); }}
            className="btn-icon relative"
          >
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
            )}
          </button>

          <AnimatePresence>
            {showNotif && (
              <motion.div
                className="absolute right-0 top-[calc(100%+8px)] w-[340px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-modal overflow-hidden z-50"
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[14px] text-slate-900 dark:text-white">Notifications</span>
                    {unread > 0 && <Badge variant="primary">{unread} new</Badge>}
                  </div>
                  <button
                    onClick={markAllRead}
                    className="text-[12px] text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1"
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                </div>
                <div className="max-h-[340px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-[13px]">All caught up! 🎉</div>
                  ) : notifications.map((n) => {
                    const cfg = notifIconMap[n.type] || notifIconMap.system;
                    return (
                      <div
                        key={n.id}
                        className={cn('flex gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 transition-colors', n.unread ? 'bg-primary-50/40 dark:bg-primary-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30')}
                      >
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-[14px] flex-shrink-0', cfg.bg)}>{cfg.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate">{n.title}</p>
                          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{n.body}</p>
                          <p className="text-[11px] text-slate-400 mt-1">{n.time}</p>
                        </div>
                        <button onClick={() => dismissNotification(n.id)} className="text-slate-300 hover:text-slate-500 flex-shrink-0 mt-0.5">
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setShowProfile((s) => !s); setShowNotif(false); }}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Avatar user={authUser} size="sm" showStatus />
            <div className="hidden sm:block text-left">
              <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 leading-none">{authUser?.name?.split(' ')[0]}</div>
              <div className="text-[11px] text-slate-500 capitalize mt-0.5">{authUser?.role}</div>
            </div>
            <ChevronDown size={13} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {showProfile && (
              <motion.div
                className="absolute right-0 top-[calc(100%+8px)] w-[220px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-modal overflow-hidden z-50"
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                {/* User info */}
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <Avatar user={authUser} size="md" />
                    <div>
                      <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white">{authUser?.name}</p>
                      <p className="text-[11.5px] text-slate-500">{authUser?.email}</p>
                      <span className={cn('badge text-[10px] mt-1', roleCfg.tw)}>{roleCfg.label}</span>
                    </div>
                  </div>
                </div>
                {/* Menu */}
                <div className="p-1.5">
                  {[
                    { icon: User, label: 'Profile', path: '/settings' },
                    { icon: Settings, label: 'Settings', path: '/settings' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { navigate(item.path); setShowProfile(false); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <item.icon size={14} className="text-slate-400" />
                      {item.label}
                    </button>
                  ))}
                  <hr className="my-1 border-slate-200 dark:border-slate-700" />
                  <button
                    onClick={logout}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
