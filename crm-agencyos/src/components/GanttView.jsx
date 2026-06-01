import { useMemo, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { cn, PRIORITY_CONFIG } from '../utils/helpers';
import { Avatar } from './ui';

const LEFT_W = 285;
const DAY_W  = 36;
const ROW_H  = 52;

const STATUS_META = {
  'pending':           { fill: '#f59e0b', label: 'Pending'      },
  'in-progress':       { fill: '#3b82f6', label: 'In Progress'  },
  'sent-for-approval': { fill: '#8b5cf6', label: 'For Approval' },
  'completed':         { fill: '#10b981', label: 'Completed'    },
};

/* ── Date helpers ──────────────────────────────────────────────── */
function pd(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  return new Date(d + 'T00:00:00');
}
function addDays(d, n) {
  const date = new Date(pd(d));
  date.setDate(date.getDate() + n);
  return date;
}
function daysDiff(a, b) {
  return Math.round((pd(b) - pd(a)) / 86400000);
}
function toStr(d) { return pd(d).toISOString().split('T')[0]; }

/* ── GanttView ─────────────────────────────────────────────────── */
/**
 * items: {
 *   id, title, subtitle?, startDate?, dueDate?,
 *   priority, status, assignee (user obj), raw (original obj)
 * }[]
 * onItemClick: (raw) => void
 */
export default function GanttView({
  items = [],
  onItemClick,
  emptyTitle       = 'No items to display',
  emptyDescription = 'Items with start and due dates will appear here.',
}) {
  const wrapRef  = useRef(null);
  const todayStr = new Date().toISOString().split('T')[0];

  const datedItems   = items.filter(i => i.startDate && i.dueDate);
  const undatedItems = items.filter(i => !i.startDate || !i.dueDate);

  /* ── Compute range ── */
  const { rangeStart, totalDays } = useMemo(() => {
    if (datedItems.length === 0) {
      return { rangeStart: addDays(new Date(), -7), totalDays: 44 };
    }
    const minD = new Date(Math.min(...datedItems.map(i => pd(i.startDate))));
    const maxD = new Date(Math.max(...datedItems.map(i => pd(i.dueDate))));
    const s = addDays(minD, -7);
    const e = addDays(maxD, 7);
    return { rangeStart: s, totalDays: Math.max(30, daysDiff(s, e) + 1) };
  }, [datedItems]);

  const todayOffset = daysDiff(rangeStart, new Date());

  /* Scroll so today is roughly ⅓ from left on mount */
  useEffect(() => {
    if (!wrapRef.current) return;
    const desired = Math.max(0, todayOffset * DAY_W - (wrapRef.current.clientWidth - LEFT_W) * 0.33);
    wrapRef.current.scrollLeft = desired;
  }, []); // eslint-disable-line

  /* ── Month groups ── */
  const months = useMemo(() => {
    const res = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(rangeStart, i);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const last = res[res.length - 1];
      if (!last || last.key !== key) {
        res.push({
          key,
          label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          short: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          start: i, span: 1,
        });
      } else { last.span++; }
    }
    return res;
  }, [rangeStart, totalDays]);

  /* ── Day headers ── */
  const dayHeaders = useMemo(() =>
    Array.from({ length: totalDays }, (_, i) => {
      const d = addDays(rangeStart, i);
      const s = toStr(d);
      return {
        s, num: d.getDate(),
        short: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
        isToday: s === todayStr,
        isWeekend: [0, 6].includes(d.getDay()),
      };
    }),
  [rangeStart, totalDays, todayStr]);

  /* ── Empty state ── */
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
        <Calendar size={38} className="text-slate-300 mb-3" />
        <p className="text-[14px] font-semibold text-slate-500">{emptyTitle}</p>
        <p className="text-[12.5px] text-slate-400 mt-1 max-w-xs text-center">{emptyDescription}</p>
      </div>
    );
  }

  const timeW = totalDays * DAY_W;

  /* Bar geometry */
  const getBar = (item) => {
    if (!item.startDate || !item.dueDate) return null;
    const left  = Math.max(0, daysDiff(rangeStart, item.startDate)) * DAY_W;
    const dur   = Math.max(1, daysDiff(item.startDate, item.dueDate) + 1);
    return { left, width: dur * DAY_W };
  };

  /* ── Row renderer ── */
  const renderRow = (item, idx, showPlaceholder = false) => {
    const bar     = getBar(item);
    const sc      = STATUS_META[item.status] || STATUS_META.pending;
    const pc      = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
    const overdue = item.dueDate && item.dueDate < todayStr && item.status !== 'completed';
    const tip     = [
      item.title,
      item.subtitle,
      item.startDate && item.dueDate ? `${item.startDate} → ${item.dueDate}` : null,
      `Status: ${sc.label}`,
      overdue ? '⚠ Overdue' : null,
    ].filter(Boolean).join('\n');

    return (
      <div key={item.id} className="flex" style={{ height: ROW_H }}>

        {/* ── Sticky label ── */}
        <div
          className={cn(
            'sticky left-0 z-10 flex items-center gap-2 px-3',
            'border-b border-r border-slate-200 dark:border-slate-700',
            'bg-white dark:bg-slate-900',
            'hover:bg-slate-50 dark:hover:bg-slate-800/60',
            'cursor-pointer transition-colors select-none',
          )}
          style={{ width: LEFT_W, minWidth: LEFT_W, borderLeft: `3px solid ${pc.dot}` }}
          onClick={() => onItemClick?.(item.raw)}
        >
          <Avatar user={item.assignee} size="xs" />
          <div className="flex-1 min-w-0">
            {item.subtitle && (
              <p className="text-[9.5px] font-mono text-slate-400 leading-none mb-0.5 truncate">
                {item.subtitle}
              </p>
            )}
            <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-snug">
              {item.title}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc.fill }} />
              <span className="text-[10px] text-slate-500 truncate">{sc.label}</span>
              {overdue && (
                <span className="ml-1 text-[9.5px] font-bold text-red-500">⚠ Overdue</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Timeline cell ── */}
        <div
          className={cn(
            'relative border-b border-slate-200 dark:border-slate-700',
            idx % 2 !== 0 ? 'bg-slate-50/40 dark:bg-slate-800/10' : '',
          )}
          style={{ width: timeW, minWidth: timeW }}
        >
          {/* Weekend shading */}
          {dayHeaders.map((day, di) =>
            day.isWeekend ? (
              <div key={di}
                className="absolute inset-y-0 pointer-events-none bg-slate-100/70 dark:bg-slate-800/30"
                style={{ left: di * DAY_W, width: DAY_W }}
              />
            ) : null
          )}

          {/* Today vertical line */}
          {todayOffset >= 0 && todayOffset < totalDays && (
            <div
              className="absolute inset-y-0 w-[2px] z-10 pointer-events-none"
              style={{
                left: todayOffset * DAY_W + DAY_W / 2 - 1,
                background: 'rgba(99,102,241,0.45)',
              }}
            />
          )}

          {/* Task / Todo bar */}
          {bar && (
            <div
              className="absolute top-1/2 -translate-y-1/2 rounded-[6px] cursor-pointer transition-all hover:brightness-90 active:scale-[0.99] shadow-sm flex items-center overflow-hidden"
              style={{
                left: bar.left + 3,
                width: Math.max(bar.width - 6, 18),
                height: 30,
                background: sc.fill,
                opacity: item.status === 'completed' ? 0.65 : 1,
              }}
              onClick={() => onItemClick?.(item.raw)}
              title={tip}
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-0 px-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 flex-shrink-0" />
                {bar.width > 80 && (
                  <span className="text-[11px] font-semibold text-white truncate leading-none">
                    {item.title}
                  </span>
                )}
              </div>
              {overdue && (
                <span className="pr-1.5 text-white font-bold text-[10px] flex-shrink-0">⚠</span>
              )}
            </div>
          )}

          {/* No-date placeholder */}
          {!bar && showPlaceholder && (
            <div className="flex items-center h-full px-3">
              <span
                className="text-[11.5px] text-slate-400 italic border border-dashed border-slate-300 dark:border-slate-600 rounded px-3 py-1 cursor-pointer hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                onClick={() => onItemClick?.(item.raw)}
              >
                No dates set — click to edit
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={wrapRef}
      className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-xl max-h-[75vh] bg-white dark:bg-slate-900"
    >
      <div style={{ minWidth: LEFT_W + timeW }}>

        {/* ══════════ STICKY HEADER ══════════ */}
        <div className="sticky top-0 z-20 flex border-b border-slate-200 dark:border-slate-700">

          {/* Corner: sticky top+left */}
          <div
            className="sticky left-0 z-30 flex items-end px-4 pb-2.5 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
            style={{ width: LEFT_W, minWidth: LEFT_W, height: 72 }}
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 select-none">
              Title / Assignee
            </span>
          </div>

          {/* Date columns */}
          <div style={{ width: timeW, minWidth: timeW }}>
            {/* Month row */}
            <div className="flex border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60" style={{ height: 36 }}>
              {months.map(m => (
                <div
                  key={m.key}
                  className="flex items-center px-2 border-r border-slate-200 dark:border-slate-700/50 text-[11px] font-bold text-slate-600 dark:text-slate-300 overflow-hidden shrink-0"
                  style={{ width: m.span * DAY_W }}
                >
                  {m.span * DAY_W >= 80 ? m.label : m.span * DAY_W >= 42 ? m.short : ''}
                </div>
              ))}
            </div>

            {/* Day row */}
            <div className="flex bg-slate-50 dark:bg-slate-800/60" style={{ height: 36 }}>
              {dayHeaders.map((day, di) => (
                <div
                  key={di}
                  className={cn(
                    'flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-700/40 shrink-0 select-none',
                    day.isToday
                      ? 'bg-indigo-500 text-white font-bold'
                      : day.isWeekend
                      ? 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-400 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 font-semibold'
                  )}
                  style={{ width: DAY_W, fontSize: '9.5px', lineHeight: 1 }}
                >
                  <span className="opacity-70">{day.short}</span>
                  <span className="mt-0.5 font-bold">{day.num}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════ DATED ROWS ══════════ */}
        {datedItems.map((item, idx) => renderRow(item, idx))}

        {/* ══════════ NO-DATE SECTION ══════════ */}
        {undatedItems.length > 0 && (
          <>
            {/* Section divider */}
            <div className="flex" style={{ height: 34 }}>
              <div
                className="sticky left-0 z-10 flex items-center px-4 border-b border-r border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20"
                style={{ width: LEFT_W, minWidth: LEFT_W }}
              >
                <span className="text-[10.5px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 select-none">
                  No Timeline · {undatedItems.length}
                </span>
              </div>
              <div
                className="border-b border-amber-200 dark:border-amber-700/40 bg-amber-50/40 dark:bg-amber-900/10"
                style={{ width: timeW, minWidth: timeW }}
              />
            </div>
            {undatedItems.map((item, idx) => renderRow(item, datedItems.length + idx, true))}
          </>
        )}

        {/* Bottom padding */}
        <div style={{ height: 12 }} />
      </div>
    </div>
  );
}
