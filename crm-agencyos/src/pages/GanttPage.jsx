import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { Page, Avatar } from '../components/ui';
import { cn, sameId, getId, PRIORITY_CONFIG } from '../utils/helpers';

// ── Layout constants ─────────────────────────────────────────────────
const DAY_W  = 36;   // px width per day column
const LEFT_W = 272;  // px width of the task-name column
const ROW_H  = 44;   // px height of each task row

// Colors assigned per group (project / client / inhouse)
const PALETTE = [
  '#6366F1','#8B5CF6','#EC4899','#14B8A6',
  '#F97316','#EF4444','#10B981','#3B82F6','#F59E0B','#06B6D4',
];

const DAY_ABBR  = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTH_ABB = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Date helpers ─────────────────────────────────────────────────────
function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function startOfDay(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function diffDays(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

// ── Component ─────────────────────────────────────────────────────────
export default function GanttPage() {
  const tasks    = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);
  const clients  = useAppStore((s) => s.clients);
  const users    = useAppStore((s) => s.users);

  // collapsed[id] === true means collapsed; default (undefined) means expanded
  const [collapsed, setCollapsed] = useState({});
  const toggle  = (id) => setCollapsed((s) => ({ ...s, [id]: !s[id] }));
  const isOpen  = (id) => !collapsed[id];

  // ── Build date range from actual task data ────────────────────────
  const { rangeStart, totalDays, dates, todayOffset, monthGroups, weekendIndices } = useMemo(() => {
    const today = startOfDay(new Date());
    const ts = [];

    tasks.forEach((t) => {
      const s = parseDate(t.startDate) || parseDate(t.createdAt);
      const e = parseDate(t.dueDate);
      if (s) ts.push(startOfDay(s).getTime());
      if (e) ts.push(startOfDay(e).getTime());
    });
    projects.forEach((p) => {
      if (p.startDate) ts.push(startOfDay(new Date(p.startDate)).getTime());
      if (p.endDate)   ts.push(startOfDay(new Date(p.endDate)).getTime());
    });

    let minD = ts.length ? startOfDay(new Date(Math.min(...ts))) : addDays(today, -7);
    let maxD = ts.length ? startOfDay(new Date(Math.max(...ts))) : addDays(today, 28);

    // Always include today in the visible range
    if (minD > today) minD = today;
    if (maxD < today) maxD = addDays(today, 21);

    // Add padding on both ends
    minD = addDays(minD, -5);
    maxD = addDays(maxD, 10);

    // Snap start to Monday so weekend stripes are regular
    const dow = minD.getDay();
    minD = addDays(minD, -(dow === 0 ? 6 : dow - 1));

    const days = Math.max(35, diffDays(minD, maxD) + 1);
    const arr  = Array.from({ length: days }, (_, i) => addDays(minD, i));

    const todayOff = diffDays(minD, today);

    // Month groups for the two-row header
    const months = [];
    let cur = null;
    arr.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!cur || cur.key !== key) {
        if (cur) months.push(cur);
        cur = { key, label: `${MONTH_ABB[d.getMonth()]} ${d.getFullYear()}`, count: 1 };
      } else {
        cur.count++;
      }
    });
    if (cur) months.push(cur);

    // Indices of weekend columns (rendered once as full-height stripes)
    const wkIdx = arr.reduce((acc, d, i) => {
      if (d.getDay() === 0 || d.getDay() === 6) acc.push(i);
      return acc;
    }, []);

    return {
      rangeStart:     minD,
      totalDays:      days,
      dates:          arr,
      todayOffset:    todayOff,
      monthGroups:    months,
      weekendIndices: wkIdx,
    };
  }, [tasks, projects]);

  // ── Group tasks by project → client → inhouse ────────────────────
  const groups = useMemo(() => {
    const projMap    = {};
    const clientMap  = {};
    const inhouse    = [];

    projects.forEach((p, i) => {
      const client = clients.find((c) => sameId(c, p.clientId));
      projMap[getId(p)] = {
        id:       getId(p),
        name:     p.name,
        subtitle: client?.name || '',
        color:    PALETTE[i % PALETTE.length],
        tasks:    [],
      };
    });

    tasks.forEach((task) => {
      const pid = task.projectId ? getId(task.projectId) : null;
      if (pid && projMap[pid]) {
        projMap[pid].tasks.push(task);
        return;
      }
      const cid = task.clientId ? getId(task.clientId) : null;
      if (cid) {
        if (!clientMap[cid]) {
          const client = clients.find((c) => sameId(c, cid));
          const idx    = Object.keys(clientMap).length + projects.length;
          clientMap[cid] = {
            id:       `_c_${cid}`,
            name:     client?.name || 'Client Tasks',
            subtitle: 'client tasks',
            color:    PALETTE[idx % PALETTE.length],
            tasks:    [],
          };
        }
        clientMap[cid].tasks.push(task);
        return;
      }
      inhouse.push(task);
    });

    const result = [
      ...Object.values(projMap).filter((g) => g.tasks.length > 0),
      ...Object.values(clientMap),
    ];
    if (inhouse.length > 0) {
      result.push({
        id:       '_inhouse',
        name:     'In-House Tasks',
        subtitle: '',
        color:    PALETTE[result.length % PALETTE.length],
        tasks:    inhouse,
      });
    }
    return result;
  }, [tasks, projects, clients]);

  // ── Compute Gantt bar geometry for one task ───────────────────────
  const getBar = useCallback((task) => {
    const s = parseDate(task.startDate) || parseDate(task.createdAt);
    const e = parseDate(task.dueDate);
    if (!s) return null;

    const startOff = diffDays(rangeStart, s);
    const endOff   = e ? diffDays(rangeStart, e) : startOff + 6;

    // Clamp to visible range
    const cStart = Math.max(0, startOff);
    const cEnd   = Math.min(totalDays - 1, endOff);
    if (cEnd < 0 || cStart >= totalDays) return null;

    const width    = Math.max(1, cEnd - cStart + 1) * DAY_W - 8;
    const cfg      = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
    const progress = task.progress ?? 0;

    return {
      left:     cStart * DAY_W + 4,
      width,
      fill:     cfg.color,
      bg:       cfg.bg,
      progress,
      title:    `${task.title}  ·  Priority: ${task.priority || 'medium'}  ·  ${progress}% done${task.dueDate ? `  ·  Due ${task.dueDate}` : ''}`,
    };
  }, [rangeStart, totalDays]);

  const totalWidth = LEFT_W + totalDays * DAY_W;

  // ── Empty state ───────────────────────────────────────────────────
  if (tasks.length === 0) {
    return (
      <Page>
        <div className="mb-6">
          <h1 className="page-title">Gantt Chart</h1>
          <p className="page-sub">Project timeline & task scheduling</p>
        </div>
        <div className="card flex flex-col items-center justify-center py-24">
          <Calendar size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-1">No tasks to display</h3>
          <p className="text-sm text-slate-400 text-center max-w-xs">
            Create tasks with start and due dates to see them on the Gantt timeline.
          </p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      {/* Page heading + priority legend */}
      <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Gantt Chart</h1>
          <p className="page-sub">Project timeline & task scheduling</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: v.color }} />
              <span className="text-xs text-slate-500 capitalize">{k}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {/*
          ─────────────────────────────────────────────────────────────
          SINGLE SCROLL CONTAINER
          • overflow: auto  →  scrolls both horizontally and vertically
          • All sticky elements (header, left column) are direct/nested
            children of THIS element so sticky positioning works
          ─────────────────────────────────────────────────────────────
        */}
        <div
          className="overflow-auto"
          style={{ maxHeight: 'calc(100vh - 300px)', minHeight: 200 }}
        >
          {/* Inner content — always at least totalWidth wide */}
          <div style={{ minWidth: totalWidth, position: 'relative' }}>

            {/*
              ── Full-height background layer (rendered ONCE) ──────────
              Sits behind everything. Contains weekend stripes + today line.
              Does NOT cover the sticky left column (left: LEFT_W).
            */}
            <div
              className="absolute top-0 left-0 bottom-0 pointer-events-none"
              style={{ left: LEFT_W, right: 0, zIndex: 0 }}
            >
              {/* Weekend highlight stripes */}
              {weekendIndices.map((wi) => (
                <div
                  key={wi}
                  className="absolute top-0 bottom-0 bg-slate-100/60 dark:bg-slate-700/20"
                  style={{ left: wi * DAY_W, width: DAY_W }}
                />
              ))}
              {/* Today vertical line */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  className="absolute top-0 bottom-0"
                  style={{
                    left:       todayOffset * DAY_W + Math.floor(DAY_W / 2),
                    width:      2,
                    background: 'rgba(99,102,241,0.35)',
                  }}
                />
              )}
            </div>

            {/*
              ── STICKY HEADER (two rows) ───────────────────────────────
              sticky top-0 keeps it visible while scrolling vertically.
              The left cell inside each header row is sticky left-0 so
              the top-left corner stays frozen when scrolling horizontally.
            */}
            <div className="sticky top-0 z-20 flex flex-col">

              {/* Row 1 — Month labels */}
              <div className="flex bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                {/* Top-left corner cell */}
                <div
                  className="flex-shrink-0 sticky left-0 z-30 flex items-center px-4 py-2 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700"
                  style={{ width: LEFT_W }}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Task / Project
                  </span>
                </div>
                {/* Month spans */}
                {monthGroups.map((m) => (
                  <div
                    key={m.key}
                    className="flex-shrink-0 text-[11px] font-bold text-slate-600 dark:text-slate-300 px-2 py-2 border-r border-slate-200 dark:border-slate-700 last:border-r-0"
                    style={{ width: m.count * DAY_W, minWidth: m.count * DAY_W }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Row 2 — Day numbers */}
              <div className="flex bg-white dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-600">
                {/* Top-left corner cell (day row) */}
                <div
                  className="flex-shrink-0 sticky left-0 z-30 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700"
                  style={{ width: LEFT_W }}
                />
                {dates.map((d, i) => {
                  const isToday  = i === todayOffset;
                  const isWknd   = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex-shrink-0 flex flex-col items-center justify-center py-1 border-r border-slate-200 dark:border-slate-700 last:border-r-0',
                        isToday
                          ? 'bg-primary-50 dark:bg-primary-900/30'
                          : isWknd
                          ? 'bg-slate-100/70 dark:bg-slate-700/30'
                          : '',
                      )}
                      style={{ width: DAY_W, minWidth: DAY_W }}
                    >
                      <span
                        className={cn(
                          'text-[9px] font-medium leading-none',
                          isToday ? 'text-primary-500 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500',
                        )}
                      >
                        {DAY_ABBR[d.getDay()]}
                      </span>
                      {isToday ? (
                        <span className="mt-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-primary-500 text-white text-[11px] font-bold leading-none">
                          {d.getDate()}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'mt-0.5 text-[11px] font-bold leading-none',
                            isWknd ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300',
                          )}
                        >
                          {d.getDate()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── GROUPS ─────────────────────────────────────────────── */}
            {groups.map((group) => (
              <div key={group.id}>

                {/* Group header row */}
                <div
                  className="flex items-center border-b border-slate-200 dark:border-slate-700 cursor-pointer select-none"
                  onClick={() => toggle(group.id)}
                >
                  {/* Sticky left cell — group name */}
                  <div
                    className="flex-shrink-0 sticky left-0 z-10 flex items-center gap-2 px-3 py-2.5 border-r border-slate-200 dark:border-slate-700"
                    style={{ width: LEFT_W, background: group.color + '1a' }}
                  >
                    <span className="text-slate-400 flex-shrink-0">
                      {isOpen(group.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </span>
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: group.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                        {group.name}
                      </p>
                      {group.subtitle && (
                        <p className="text-[10.5px] text-slate-500 truncate leading-tight">{group.subtitle}</p>
                      )}
                    </div>
                    <span className="text-[10.5px] text-slate-400 flex-shrink-0 ml-1">
                      {group.tasks.length}
                    </span>
                  </div>

                  {/* Group progress bar (spans the bar canvas area) */}
                  <div
                    className="flex-1 flex items-center gap-3 px-5 py-2.5"
                    style={{ background: group.color + '0a' }}
                  >
                    {(() => {
                      const avg = Math.round(
                        group.tasks.reduce((a, t) => a + (t.progress ?? 0), 0) / group.tasks.length,
                      );
                      return (
                        <>
                          <div className="h-1.5 flex-1 max-w-xs bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${avg}%`, background: group.color }}
                            />
                          </div>
                          <span
                            className="text-[11px] font-semibold flex-shrink-0"
                            style={{ color: group.color }}
                          >
                            {avg}%
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Task rows */}
                {isOpen(group.id) && group.tasks.map((task, tIdx) => {
                  const assignee = users.find((u) => sameId(u, task.assignedTo));
                  const bar      = getBar(task);

                  return (
                    <div
                      key={getId(task)}
                      className="flex items-center border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors"
                      style={{ height: ROW_H }}
                    >
                      {/* Sticky left cell — task name */}
                      <div
                        className="flex-shrink-0 sticky left-0 z-10 flex items-center gap-2 px-3 h-full border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        style={{ width: LEFT_W }}
                      >
                        <Avatar user={assignee} size="xs" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] text-slate-700 dark:text-slate-300 truncate leading-tight">
                            {task.title}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate capitalize leading-tight">
                            {task.status?.replace(/-/g, ' ') || 'pending'}
                          </p>
                        </div>
                      </div>

                      {/* Bar canvas — CSS gradient for vertical grid lines */}
                      <div
                        className="relative flex-1"
                        style={{
                          height: ROW_H,
                          backgroundImage: `repeating-linear-gradient(90deg, transparent 0px, transparent ${DAY_W - 1}px, rgba(148,163,184,0.12) ${DAY_W - 1}px, rgba(148,163,184,0.12) ${DAY_W}px)`,
                        }}
                      >
                        {/* Gantt bar */}
                        {bar ? (
                          <motion.div
                            key={`bar-${getId(task)}`}
                            initial={{ opacity: 0, scaleX: 0 }}
                            animate={{ opacity: 1, scaleX: 1 }}
                            transition={{ duration: 0.3, ease: 'easeOut', delay: Math.min(tIdx * 0.025, 0.4) }}
                            className="absolute z-[3]"
                            style={{
                              left:            bar.left,
                              width:           bar.width,
                              top:             '50%',
                              transform:       'translateY(-50%)',
                              transformOrigin: 'left center',
                            }}
                          >
                            <div
                              className="h-[22px] rounded-full overflow-hidden relative cursor-default"
                              style={{ background: bar.bg }}
                              title={bar.title}
                            >
                              {/* Progress fill */}
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${bar.progress}%`, background: bar.fill }}
                              />
                              {/* Label — shows % if progress>0, else task name */}
                              <div className="absolute inset-0 flex items-center px-2.5 overflow-hidden">
                                <span
                                  className="text-[10px] font-semibold truncate"
                                  style={{ color: bar.progress > 45 ? '#fff' : bar.fill }}
                                >
                                  {bar.progress > 0 ? `${bar.progress}%` : task.title}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          /* No valid dates — show placeholder text */
                          <span
                            className="absolute top-1/2 -translate-y-1/2 text-[9.5px] text-slate-300 dark:text-slate-600 italic pointer-events-none select-none z-[3]"
                            style={{ left: 8 }}
                          >
                            no dates set
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Footer legend */}
        <div className="flex items-center gap-5 px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[11.5px] text-slate-400 flex-wrap">
          <span className="flex items-center gap-1.5">
            <div className="w-0.5 h-3 rounded-full bg-primary-400" />
            Today
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-2 rounded bg-slate-200 dark:bg-slate-700" />
            Weekend
          </span>
          <span>Bar fill = completion %</span>
          <span>Bar length = start → due date</span>
          <span className="ml-auto">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {groups.length} group{groups.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </Page>
  );
}
