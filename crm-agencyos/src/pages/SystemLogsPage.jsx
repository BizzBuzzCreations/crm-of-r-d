import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal, RefreshCw, Pause, Play, Trash2, Download,
  Search, X, Wifi, WifiOff, Server, Database, Mail,
  Cpu, HardDrive, Clock, AlertCircle, Info, Bug, AlertTriangle,
  Activity, Layers,
} from 'lucide-react';
import { systemLogsAPI } from '../services/api';
import { getSock } from '../store/useAppStore';
import { cn } from '../utils/helpers';

// ── Config ────────────────────────────────────────────────────

const SOURCES = [
  { key: 'all',           label: 'All',           icon: Layers   },
  { key: 'combined',      label: 'Backend',        icon: Server   },
  { key: 'error',         label: 'Errors',         icon: AlertCircle },
  { key: 'worker-out',    label: 'Worker',         icon: Activity },
  { key: 'email',         label: 'Email',          icon: Mail     },
  { key: 'queue',         label: 'Queue',          icon: Layers   },
  { key: 'system',        label: 'System',         icon: Server   },
  { key: 'http',          label: 'HTTP',           icon: Wifi     },
];

const LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'];

const LEVEL_STYLE = {
  ERROR: { text: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-500/30',    label: 'ERR' },
  WARN:  { text: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-500/30', label: 'WRN' },
  INFO:  { text: 'text-emerald-400',bg: 'bg-emerald-400/10',border: 'border-emerald-500/30',label: 'INF' },
  DEBUG: { text: 'text-slate-500',  bg: 'bg-slate-500/10',  border: 'border-slate-600/30',  label: 'DBG' },
};

const SOURCE_COLOR = {
  DB:     'text-amber-400',    MONGO: 'text-amber-400',
  REDIS:  'text-red-400',
  EMAIL:  'text-cyan-400',     SMTP: 'text-cyan-400',
  QUEUE:  'text-purple-400',   BULLMQ: 'text-purple-400', WORKER: 'text-purple-400',
  SERVER: 'text-indigo-400',
  HTTP:   'text-blue-400',
  AUTH:   'text-pink-400',
  SOCKET: 'text-teal-400',
  API:    'text-orange-400',
};

function srcColor(src) { return SOURCE_COLOR[src?.toUpperCase()] ?? 'text-slate-400'; }

function levelStyle(lvl) { return LEVEL_STYLE[lvl?.toUpperCase()] ?? LEVEL_STYLE.INFO; }

// ── Timestamp formatting ──────────────────────────────────────

function fmtTs(ts) {
  if (!ts) return '--:--:--';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts.slice(0, 19).replace('T', ' ');
  return d.toTimeString().slice(0, 8);
}

// ── Log line component ────────────────────────────────────────

function LogLine({ entry }) {
  const ls = levelStyle(entry.level);
  return (
    <div className={cn(
      'flex items-start gap-2 px-3 py-0.5 font-mono text-[12px] leading-relaxed hover:bg-white/[0.03] rounded transition-colors group select-text',
      entry.level === 'ERROR' && 'bg-red-950/10 hover:bg-red-950/20',
      entry.level === 'WARN'  && 'bg-yellow-950/10 hover:bg-yellow-950/20',
    )}>
      {/* Timestamp */}
      <span className="text-slate-600 flex-shrink-0 tabular-nums w-[74px] mt-0.5">{fmtTs(entry.ts)}</span>

      {/* Level badge */}
      <span className={cn('flex-shrink-0 font-bold w-[28px] mt-0.5 text-[10px] uppercase', ls.text)}>
        {ls.label}
      </span>

      {/* Source tag */}
      <span className={cn('flex-shrink-0 text-[10.5px] font-bold w-[60px] mt-0.5 truncate uppercase', srcColor(entry.source))}>
        [{entry.source ?? '?'}]
      </span>

      {/* Message */}
      <span className={cn('flex-1 min-w-0 break-words', ls.text === 'text-red-400' ? 'text-red-300' : 'text-slate-300')}>
        {entry.message}
      </span>
    </div>
  );
}

// ── Server Health Panel ───────────────────────────────────────

function StatusDot({ online }) {
  return (
    <span className={cn(
      'inline-block w-2 h-2 rounded-full flex-shrink-0',
      online ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-red-500'
    )} />
  );
}

function MemBar({ used, total, label }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const color = pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-emerald-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-slate-400">
        <span>{label}</span>
        <span>{Math.round(used / 1024 / 1024)} MB / {Math.round(total / 1024 / 1024)} MB ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function fmtUptime(s) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function HealthPanel({ status, loading, onRefresh }) {
  if (loading) return (
    <div className="flex items-center justify-center h-32 text-slate-500 text-[12px]">
      <RefreshCw size={14} className="animate-spin mr-2" /> Loading…
    </div>
  );
  if (!status) return (
    <div className="text-center text-slate-600 text-[12px] py-6">
      Status unavailable
    </div>
  );

  const { server, memory, cpu, services, pm2 } = status;
  const mongoOk  = services?.mongodb  === 'connected';
  const redisOk  = services?.redis    === 'connected';
  const backendOk = services?.backend  === 'online';

  return (
    <div className="space-y-5 p-4">
      {/* Services */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">Services</p>
        <div className="space-y-2">
          {[
            { label: 'Backend API',  ok: backendOk },
            { label: 'MongoDB',      ok: mongoOk  },
            { label: 'Redis',        ok: redisOk  },
            ...(pm2?.map(p => ({ label: `PM2: ${p.name}`, ok: p.status === 'online' })) ?? []),
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center justify-between text-[12px]">
              <div className="flex items-center gap-2">
                <StatusDot online={ok} />
                <span className="text-slate-300">{label}</span>
              </div>
              <span className={cn('text-[11px] font-semibold', ok ? 'text-emerald-400' : 'text-red-400')}>
                {ok ? 'Online' : 'Offline'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Memory */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">Memory</p>
        <div className="space-y-3">
          <MemBar label="Heap Used" used={memory.heapUsed} total={memory.heapTotal} />
          <MemBar label="RSS"       used={memory.rss}      total={memory.sysFree + memory.rss} />
          <MemBar label="System"    used={memory.sysTotal - memory.sysFree} total={memory.sysTotal} />
        </div>
      </div>

      {/* Server info */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">Server</p>
        <div className="space-y-1.5 text-[12px]">
          {[
            { label: 'Uptime',    value: fmtUptime(server.uptime) },
            { label: 'PID',       value: server.pid },
            { label: 'Node.js',   value: server.nodeVersion },
            { label: 'Platform',  value: server.platform },
            { label: 'Env',       value: server.env },
            { label: 'CPU',       value: `${cpu.count}× ${cpu.model?.split('@')[0]?.trim()}` },
            { label: 'Load Avg',  value: cpu.loadAvg?.map(l => l.toFixed(2)).join(', ') },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-2">
              <span className="text-slate-500 flex-shrink-0">{label}</span>
              <span className="text-slate-300 font-mono text-right truncate">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PM2 processes table */}
      {pm2?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">PM2 Processes</p>
          {pm2.map(p => (
            <div key={p.name} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800 last:border-0">
              <span className="text-slate-300 font-medium">{p.name}</span>
              <div className="flex items-center gap-2 text-slate-500">
                {p.memory && <span>{Math.round(p.memory / 1024 / 1024)}MB</span>}
                {p.cpu != null && <span>{p.cpu}%</span>}
                <span className={p.status === 'online' ? 'text-emerald-400' : 'text-red-400'}>
                  {p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onRefresh}
        className="w-full py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors">
        <RefreshCw size={11} /> Refresh Status
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

const MAX_BUFFER = 3000; // max lines kept in memory

export default function SystemLogsPage() {
  const [activeSource, setActiveSource] = useState('combined');
  const [levelFilter,  setLevelFilter]  = useState('ALL');
  const [search,       setSearch]       = useState('');
  const [paused,       setPaused]       = useState(false);
  const [lines,        setLines]        = useState([]);  // all received lines
  const [status,       setStatus]       = useState(null);
  const [statusLoad,   setStatusLoad]   = useState(false);
  const [loadingLogs,  setLoadingLogs]  = useState(false);
  const [isLive,       setIsLive]       = useState(false);
  const [sources,      setSources]      = useState([]);

  const termRef       = useRef(null);
  const autoScrollRef = useRef(true);
  const pausedRef     = useRef(false); // sync ref for socket callback
  const pendingRef    = useRef([]);    // buffer new lines while paused

  pausedRef.current = paused;

  // ── Socket subscription ───────────────────────────────────

  useEffect(() => {
    const socket = getSock();
    if (!socket) return;

    const handleLines = ({ fileKey, lines: newLines }) => {
      if (pausedRef.current) {
        pendingRef.current = [...pendingRef.current, ...newLines];
        return;
      }
      setLines(prev => {
        const merged = [...prev, ...newLines];
        return merged.length > MAX_BUFFER ? merged.slice(-MAX_BUFFER) : merged;
      });
    };

    socket.emit('system:logs:subscribe');
    socket.on('system:log:lines', handleLines);
    setIsLive(true);

    return () => {
      socket.emit('system:logs:unsubscribe');
      socket.off('system:log:lines', handleLines);
      setIsLive(false);
    };
  }, []);

  // When unpausing, flush pending buffer
  useEffect(() => {
    if (!paused && pendingRef.current.length > 0) {
      const pending = pendingRef.current;
      pendingRef.current = [];
      setLines(prev => {
        const merged = [...prev, ...pending];
        return merged.length > MAX_BUFFER ? merged.slice(-MAX_BUFFER) : merged;
      });
    }
  }, [paused]);

  // ── Initial log fetch + status ─────────────────────────────

  const fetchLogs = useCallback(async (src) => {
    if (src === 'all') {
      // 'all' uses only socket-streamed data — just clear and wait
      setLines([]);
      return;
    }
    setLoadingLogs(true);
    try {
      const { data } = await systemLogsAPI.getLogs(src, { lines: 400 });
      setLines(data.data ?? []);
    } catch {
      setLines([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    setStatusLoad(true);
    try {
      const { data } = await systemLogsAPI.getStatus();
      setStatus(data.data);
    } catch {
      setStatus(null);
    } finally {
      setStatusLoad(false);
    }
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      const { data } = await systemLogsAPI.listSources();
      setSources(data.data ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchLogs(activeSource);
    fetchStatus();
    fetchSources();
  }, []);

  useEffect(() => {
    fetchLogs(activeSource);
    setLevelFilter('ALL');
    setSearch('');
  }, [activeSource]);

  // ── Auto-scroll ───────────────────────────────────────────

  useEffect(() => {
    if (autoScrollRef.current && termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [lines]);

  const handleScroll = () => {
    if (!termRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = termRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  // ── Filtered view ────────────────────────────────────────

  const visible = lines.filter(l => {
    if (activeSource !== 'all' && l.fileKey && l.fileKey !== activeSource) return false;
    if (levelFilter !== 'ALL' && l.level !== levelFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.message?.toLowerCase().includes(q) && !l.source?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const errorCount = lines.filter(l => l.level === 'ERROR').length;
  const warnCount  = lines.filter(l => l.level === 'WARN').length;

  const downloadLog = () => {
    const src = activeSource === 'all' ? 'combined' : activeSource;
    const url = systemLogsAPI.downloadUrl(src);
    const token = localStorage.getItem('crm_access_token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${src}-${new Date().toISOString().slice(0,10)}.log`;
        a.click();
      }).catch(() => {});
  };

  // ── Source badge (exists status) ────────────────────────

  const srcExists = (key) => {
    if (key === 'all') return true;
    return sources.find(s => s.key === key)?.exists ?? null;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-indigo-400" />
            <span className="font-bold text-[14px] text-white tracking-tight">System Monitor</span>
          </div>
          {/* Live badge */}
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-bold border',
            isLive && !paused
              ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-400'
              : paused
                ? 'bg-amber-950/60 border-amber-700/50 text-amber-400'
                : 'bg-slate-800 border-slate-700 text-slate-500'
          )}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              isLive && !paused ? 'bg-emerald-400 animate-pulse' : paused ? 'bg-amber-400' : 'bg-slate-500'
            )} />
            {isLive && !paused ? 'LIVE' : paused ? 'PAUSED' : 'OFFLINE'}
          </div>
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded border border-red-700/30">
              <AlertCircle size={10} /> {errorCount} error{errorCount > 1 ? 's' : ''}
            </span>
          )}
          {warnCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-yellow-400 bg-yellow-950/40 px-1.5 py-0.5 rounded border border-yellow-700/30">
              <AlertTriangle size={10} /> {warnCount} warn{warnCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused(p => !p)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-medium border transition-all',
              paused
                ? 'bg-amber-600/20 border-amber-600/40 text-amber-400 hover:bg-amber-600/30'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            )}
          >
            {paused ? <><Play size={11} /> Resume</> : <><Pause size={11} /> Pause</>}
          </button>
          <button
            onClick={() => { setLines([]); pendingRef.current = []; }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-medium bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all"
          >
            <Trash2 size={11} /> Clear
          </button>
          <button
            onClick={downloadLog}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-medium bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all"
          >
            <Download size={11} /> Download
          </button>
        </div>
      </div>

      {/* ── Source tabs ── */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex-shrink-0 overflow-x-auto">
        {SOURCES.map(({ key, label, icon: Icon }) => {
          const exists = srcExists(key);
          return (
            <button
              key={key}
              onClick={() => setActiveSource(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded text-[12px] font-medium whitespace-nowrap transition-all flex-shrink-0',
                activeSource === key
                  ? 'bg-indigo-600/20 border border-indigo-600/40 text-indigo-300'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-transparent',
                exists === false && 'opacity-40'
              )}
              title={exists === false ? 'Log file not found' : ''}
            >
              <Icon size={11} />
              {label}
              {exists === false && <span className="text-[9px] text-slate-600">✕</span>}
            </button>
          );
        })}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          <input
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 pl-7 py-1.5 text-[12px] font-mono text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-600 transition-colors"
            placeholder="Search logs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
              <X size={11} />
            </button>
          )}
        </div>

        {/* Level filters */}
        <div className="flex items-center gap-1">
          {LEVELS.map(lvl => {
            const ls = lvl === 'ALL' ? null : levelStyle(lvl);
            return (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={cn(
                  'px-2.5 py-1 rounded text-[11px] font-bold border transition-all',
                  levelFilter === lvl
                    ? lvl === 'ALL'
                      ? 'bg-slate-600 border-slate-500 text-white'
                      : cn(ls?.bg, ls?.border, ls?.text)
                    : 'bg-transparent border-slate-700 text-slate-500 hover:text-slate-400 hover:border-slate-600'
                )}
              >
                {lvl}
              </button>
            );
          })}
        </div>

        {/* Line count */}
        <span className="text-[11px] text-slate-600 font-mono ml-auto">
          {visible.length} / {lines.length} lines
        </span>
      </div>

      {/* ── Main content: terminal + health panel ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Terminal output ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {loadingLogs ? (
            <div className="flex items-center justify-center flex-1 gap-2 text-slate-500 text-[13px]">
              <RefreshCw size={14} className="animate-spin" /> Loading logs…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-600">
              <Terminal size={32} className="opacity-30" />
              <p className="text-[13px]">
                {lines.length > 0 ? 'No lines match the current filter' : 'Waiting for log data…'}
              </p>
              {lines.length === 0 && (
                <p className="text-[11px] text-slate-700">Make sure the backend is running and this source is active</p>
              )}
            </div>
          ) : (
            <div
              ref={termRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
            >
              {visible.map((entry, i) => (
                <LogLine key={entry.id ?? `${i}-${entry.ts}`} entry={entry} />
              ))}
              {/* Anchor for auto-scroll */}
              <div className="h-2" />
            </div>
          )}

          {/* Scroll-to-bottom FAB when auto-scroll is off */}
          {paused && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
              <div className="bg-amber-900/80 border border-amber-700/60 text-amber-300 text-[11px] font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm">
                ⏸ Paused — {pendingRef.current.length} new lines buffered
              </div>
            </div>
          )}
        </div>

        {/* ── Server Health Panel ── */}
        <div className="w-[280px] flex-shrink-0 border-l border-slate-800 overflow-y-auto bg-slate-900/60">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Server Health</span>
            <button onClick={fetchStatus} disabled={statusLoad}
              className="text-slate-600 hover:text-slate-400 transition-colors">
              <RefreshCw size={11} className={statusLoad ? 'animate-spin' : ''} />
            </button>
          </div>
          <HealthPanel status={status} loading={statusLoad} onRefresh={fetchStatus} />
        </div>
      </div>
    </div>
  );
}
