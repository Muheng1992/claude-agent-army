import { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { TaskSnapshot } from '../types';
import { STATUS_COLORS } from '../types';

interface TaskDagProps {
  tasks: TaskSnapshot[];
}

interface DagColumn {
  depth: number;
  tasks: TaskSnapshot[];
}

function buildColumns(tasks: TaskSnapshot[]): DagColumn[] {
  if (tasks.length === 0) return [];

  const depthMap = new Map<string, number>();
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  function getDepth(taskId: string): number {
    if (depthMap.has(taskId)) return depthMap.get(taskId)!;
    const task = taskMap.get(taskId);
    if (!task || task.dependencies.length === 0) {
      depthMap.set(taskId, 0);
      return 0;
    }
    const maxDep = Math.max(...task.dependencies.map(d => getDepth(d)));
    const depth = maxDep + 1;
    depthMap.set(taskId, depth);
    return depth;
  }

  tasks.forEach(t => getDepth(t.id));

  const columnMap = new Map<number, TaskSnapshot[]>();
  tasks.forEach(t => {
    const depth = depthMap.get(t.id) ?? 0;
    if (!columnMap.has(depth)) columnMap.set(depth, []);
    columnMap.get(depth)!.push(t);
  });

  return Array.from(columnMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([depth, tasks]) => ({ depth, tasks }));
}

const CARD_W = 200;
const CARD_H = 100;
const COL_GAP = 80;
const ROW_GAP = 20;

function TaskCard({ task }: { task: TaskSnapshot }) {
  const color = STATUS_COLORS[task.status] ?? '#5a5248';
  const isRunning = task.status === 'running';

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    e.currentTarget.style.transform = `perspective(600px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'perspective(600px) rotateY(0deg) rotateX(0deg)';
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={clsx(
        'rounded border p-3 bg-abyss/90 transition-shadow duration-300 cursor-default',
        isRunning && 'pulse-glow'
      )}
      style={{
        width: CARD_W,
        minHeight: CARD_H,
        borderColor: color + '60',
        boxShadow: `inset 0 0 20px rgba(0,0,0,0.4), 0 0 4px ${color}20`,
        color,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.1s ease-out, box-shadow 0.3s',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider rounded border"
          style={{ borderColor: color + '40', backgroundColor: color + '10' }}
        >
          {task.status}
        </span>
        <span className="text-[9px] text-text-dim">{task.id.slice(-6)}</span>
      </div>
      <p className="text-xs text-text-primary truncate mb-1" title={task.title}>
        {task.title || task.id}
      </p>
      {task.model && (
        <p className="text-[9px] text-text-dim">{task.model}</p>
      )}
      {task.tokenUsage != null && (
        <div className="mt-1 h-1 w-full rounded-full bg-rust-dark overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(task.tokenUsage, 100)}%`,
              background: 'linear-gradient(90deg, #1a1410, #c4956a)',
            }}
          />
        </div>
      )}
    </motion.div>
  );
}

function DependencyArrows({ tasks, columns }: { tasks: TaskSnapshot[]; columns: DagColumn[] }) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const positionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    columns.forEach((col, ci) => {
      col.tasks.forEach((task, ri) => {
        map.set(task.id, {
          x: ci * (CARD_W + COL_GAP) + CARD_W,
          y: ri * (CARD_H + ROW_GAP) + CARD_H / 2,
        });
      });
    });
    return map;
  }, [columns]);

  const arrows: { from: { x: number; y: number }; to: { x: number; y: number }; color: string }[] = [];

  tasks.forEach(task => {
    const toPos = positionMap.get(task.id);
    if (!toPos) return;
    task.dependencies.forEach(depId => {
      const fromPos = positionMap.get(depId);
      if (!fromPos) return;
      const depTask = taskMap.get(depId);
      const color = depTask ? (STATUS_COLORS[depTask.status] ?? '#5a5248') : '#5a5248';
      arrows.push({ from: fromPos, to: { x: toPos.x - CARD_W, y: toPos.y }, color });
    });
  });

  if (arrows.length === 0) return null;

  const maxX = Math.max(...Array.from(positionMap.values()).map(p => p.x)) + 20;
  const maxY = Math.max(...Array.from(positionMap.values()).map(p => p.y)) + 20;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: maxX, height: maxY }}
    >
      {arrows.map((arrow, i) => (
        <line
          key={i}
          x1={arrow.from.x}
          y1={arrow.from.y}
          x2={arrow.to.x}
          y2={arrow.to.y}
          stroke={arrow.color}
          strokeWidth={1.5}
          strokeOpacity={0.3}
          strokeDasharray="6 4"
          className="dash-flow"
        />
      ))}
    </svg>
  );
}

export function TaskDag({ tasks }: TaskDagProps) {
  const columns = useMemo(() => buildColumns(tasks), [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="p-8 border rounded border-rust-dark bg-abyss/40 text-center" style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)' }}>
        <p className="text-text-dim text-sm">No tasks in current mission</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded border-rust-dark bg-abyss/40 overflow-x-auto" style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)' }}>
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-text-dim uppercase tracking-wider">Task DAG</span>
        <span className="text-xs text-text-dim">{tasks.length} tasks</span>
      </div>

      <div className="relative" style={{ minHeight: 120 }}>
        <DependencyArrows tasks={tasks} columns={columns} />
        <div className="flex gap-20 relative z-10">
          <AnimatePresence>
            {columns.map(col => (
              <div key={col.depth} className="flex flex-col gap-5">
                {col.tasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
