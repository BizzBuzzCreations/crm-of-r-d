import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { Page, Avatar, ProgressBar } from '../components/ui';
import { GANTT_PROJECTS } from '../mockData';
import { cn } from '../utils/helpers';

const TOTAL_DAYS = 28;
const DAY_W      = 28; // px per day cell

export default function GanttPage() {
  const users   = useAppStore((s) => s.users);
  const [expanded, setExpanded] = useState({ 1: true, 2: true, 3: true });

  const toggle = (id) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  return (
    <Page>
      <div className="mb-6">
        <h1 className="page-title">Gantt Chart</h1>
        <p className="page-sub">Project timeline & task scheduling</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 240 + TOTAL_DAYS * DAY_W }}>
            {/* Header row */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="w-60 flex-shrink-0 px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200 dark:border-slate-700">
                Task
              </div>
              <div className="flex flex-1">
                {Array.from({ length: TOTAL_DAYS }).map((_, i) => (
                  <div
                    key={i}
                    style={{ width: DAY_W }}
                    className={cn(
                      'flex-shrink-0 text-center text-[10.5px] font-semibold py-3 border-r border-slate-200 dark:border-slate-700 last:border-r-0',
                      (i + 1) % 7 === 0 ? 'bg-slate-100 dark:bg-slate-700/50' : '',
                      i === 0 ? 'text-primary-500' : 'text-slate-400',
                    )}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Projects */}
            {GANTT_PROJECTS.map((proj) => (
              <div key={proj.id}>
                {/* Project header */}
                <div
                  className="flex items-center border-b border-slate-200 dark:border-slate-700 bg-indigo-50/60 dark:bg-indigo-900/10 cursor-pointer hover:bg-indigo-100/60 dark:hover:bg-indigo-900/20 transition-colors"
                  onClick={() => toggle(proj.id)}
                >
                  <div className="w-60 flex-shrink-0 px-3 py-3 flex items-center gap-2 border-r border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400">
                      {expanded[proj.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <div>
                      <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate">{proj.project}</p>
                      <p className="text-[11px] text-slate-500 truncate">{proj.client}</p>
                    </div>
                  </div>
                  <div className="flex-1 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        {(() => {
                          const avg = Math.round(proj.tasks.reduce((a, t) => a + t.progress, 0) / proj.tasks.length);
                          return <div className="h-full rounded-full bg-indigo-400" style={{ width: `${avg}%` }} />;
                        })()}
                      </div>
                      <span className="text-[11.5px] font-semibold text-indigo-600 dark:text-indigo-400">
                        {Math.round(proj.tasks.reduce((a, t) => a + t.progress, 0) / proj.tasks.length)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tasks */}
                {expanded[proj.id] && proj.tasks.map((task) => {
                  const assignee = users.find((u) => u.id === task.assignee);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Task name */}
                      <div className="w-60 flex-shrink-0 px-4 py-2.5 flex items-center gap-2 border-r border-slate-200 dark:border-slate-700">
                        <Avatar user={assignee} size="xs" />
                        <span className="text-[12.5px] text-slate-700 dark:text-slate-300 truncate flex-1">{task.name}</span>
                      </div>

                      {/* Bar area */}
                      <div className="flex-1 relative" style={{ height: 40 }}>
                        {/* Day grid lines */}
                        {Array.from({ length: TOTAL_DAYS }).map((_, i) => (
                          <div
                            key={i}
                            className={cn('absolute top-0 bottom-0 border-r border-slate-100 dark:border-slate-800', (i + 1) % 7 === 0 && 'border-slate-200 dark:border-slate-700')}
                            style={{ left: i * DAY_W, width: DAY_W }}
                          />
                        ))}

                        {/* Gantt bar */}
                        <motion.div
                          initial={{ opacity: 0, scaleX: 0 }}
                          animate={{ opacity: 1, scaleX: 1 }}
                          transition={{ duration: 0.4, delay: 0.05 * task.id }}
                          style={{
                            left:   task.start * DAY_W + 4,
                            width:  Math.max(1, task.duration) * DAY_W - 8,
                            top:    '50%',
                            transform: 'translateY(-50%)',
                            transformOrigin: 'left center',
                          }}
                          className="absolute"
                        >
                          {/* Background track */}
                          <div
                            className="h-[22px] rounded-full overflow-hidden relative cursor-pointer group"
                            style={{ background: task.color + '30' }}
                            title={`${task.name} — ${task.progress}%`}
                          >
                            {/* Progress fill */}
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${task.progress}%`, background: task.color }}
                            />
                            {/* Label */}
                            <div className="absolute inset-0 flex items-center px-2">
                              <span className="text-[10.5px] font-semibold truncate" style={{ color: task.progress > 40 ? '#fff' : task.color }}>
                                {task.progress}%
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[12px] text-slate-500">
          <span>Each column = 1 day</span>
          <span>Shaded columns = weekends</span>
          <span>Bar fill = completion progress</span>
        </div>
      </div>
    </Page>
  );
}
