// WHY: Hierarchical flow visualization with clickable nodes for full detail view

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { TaskSnapshot, SessionSnapshot, MissionSnapshot, Decision, AgentRole } from '../types';
import { ROLE_COLORS } from '../types';
import { THEME, STATUS_THEME, Row, Section, FlowArrow } from './flow-shared';

interface AgentFlowChartProps {
  mission?: MissionSnapshot;
  tasks: TaskSnapshot[];
  sessions: SessionSnapshot[];
  decisions?: Decision[];
}

interface DepthColumn { depth: number; tasks: TaskSnapshot[]; }

function buildDepthColumns(tasks: TaskSnapshot[]): DepthColumn[] {
  if (tasks.length === 0) return [];
  const depthMap = new Map<string, number>();
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  function getDepth(taskId: string): number {
    if (depthMap.has(taskId)) return depthMap.get(taskId)!;
    const task = taskMap.get(taskId);
    if (!task || task.dependencies.length === 0) { depthMap.set(taskId, 0); return 0; }
    const maxDep = Math.max(...task.dependencies.map(d => getDepth(d)));
    depthMap.set(taskId, maxDep + 1);
    return maxDep + 1;
  }

  tasks.forEach(t => getDepth(t.id));
  const grouped = new Map<number, TaskSnapshot[]>();
  tasks.forEach(t => {
    const d = depthMap.get(t.id) ?? 0;
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push(t);
  });
  return Array.from(grouped.entries()).sort(([a], [b]) => a - b)
    .map(([depth, tasks]) => ({ depth, tasks }));
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const filled = Math.round(clamped / 10);
  return (
    <span className="text-[10px] font-mono tracking-tight" style={{ color: THEME.amber }}>
      {'\u2593'.repeat(filled)}{'\u2591'.repeat(10 - filled)} {clamped}%
    </span>
  );
}

function getRoleBorderStyle(role?: AgentRole): React.CSSProperties {
  if (role === 'architect') return { borderStyle: 'dashed' };
  return {};
}

function RoleBadge({ role }: { role?: AgentRole }) {
  if (!role) return null;
  const color = ROLE_COLORS[role];
  // WHY: 各角色用不同前綴符號強化視覺辨識
  const prefix = role === 'architect' ? '\u25B3 ' : role === 'tester' ? '\u25C6 ' : '';
  return (
    <span className="px-1.5 py-0.5 text-[7px] uppercase tracking-wider rounded border font-mono"
      style={{ color, borderColor: color + '40', backgroundColor: color + '10' }}>
      {prefix}{role}
    </span>
  );
}

function TaskNode({ task, session, isSelected, onClick }: {
  task: TaskSnapshot; session?: SessionSnapshot;
  isSelected: boolean; onClick: () => void;
}) {
  const theme = STATUS_THEME[task.status] ?? { color: THEME.dim, label: task.status };
  const roleStyle = getRoleBorderStyle(task.role);
  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }} onClick={onClick}
      className={clsx(
        'relative rounded border p-3 w-52 min-h-[90px] cursor-pointer transition-all',
        task.status === 'running' && 'pulse-glow',
        isSelected && 'ring-1'
      )}
      style={{
        borderColor: isSelected ? theme.color : theme.color + '60',
        backgroundColor: THEME.panelBg, color: theme.color,
        boxShadow: isSelected
          ? `0 0 15px ${theme.color}40, inset 0 0 10px ${theme.color}10`
          : `0 0 6px ${theme.color}20`,
        ringColor: theme.color,
        ...roleStyle,
      }}
    >
      {task.status === 'completed' && (
        <div className="absolute top-2 right-2 text-lg font-bold" style={{ color: THEME.decayGreen }}>&#10003;</div>
      )}
      {(task.status === 'failed' || task.status === 'abandoned') && (
        <div className="absolute top-2 right-2 text-lg font-bold" style={{ color: THEME.fadedRed }}>&#10007;</div>
      )}

      <div className="flex items-center gap-2 mb-1.5">
        <span className="px-1.5 py-0.5 text-[8px] uppercase tracking-wider rounded border"
          style={{ borderColor: theme.color + '40', backgroundColor: theme.color + '10' }}>
          {theme.label}
        </span>
        <span className="text-[8px] font-mono" style={{ color: THEME.dim }}>{task.id}</span>
      </div>

      {task.role && (
        <div className="mb-1.5">
          <RoleBadge role={task.role} />
        </div>
      )}

      <p className="text-xs truncate mb-1 font-mono" style={{ color: THEME.amber }} title={task.title}>
        {task.title || task.id}
      </p>

      {session && (
        <p className="text-[9px] font-mono" style={{ color: THEME.dim }}>
          {session.model} &middot; s-{session.id.slice(-6)}
        </p>
      )}

      {task.tokenUsage != null && <div className="mt-1"><ProgressBar value={task.tokenUsage} /></div>}

      {task.retryCount != null && task.retryCount > 0 && (
        <p className="text-[8px] font-mono mt-1" style={{ color: THEME.fadedRed }}>
          retry #{task.retryCount}
        </p>
      )}
    </motion.div>
  );
}

function DetailPanel({ task, session, decisions, onClose }: {
  task: TaskSnapshot; session?: SessionSnapshot;
  decisions: Decision[]; onClose: () => void;
}) {
  const theme = STATUS_THEME[task.status] ?? { color: THEME.dim, label: task.status };
  const taskDecisions = decisions.filter(d => d.taskId === task.id);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="border rounded p-4 w-full max-w-md font-mono text-xs overflow-y-auto max-h-[70vh]"
      style={{ borderColor: theme.color + '60', backgroundColor: THEME.panelBg, color: THEME.amber }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold" style={{ color: theme.color }}>{task.id}: {task.title}</span>
        <button onClick={onClose} className="text-lg cursor-pointer px-2" style={{ color: THEME.dim }}>&times;</button>
      </div>

      <div className="space-y-3">
        <Row label="STATUS" value={theme.label} color={theme.color} />
        {task.role && <Row label="ROLE" value={task.role.toUpperCase()} color={ROLE_COLORS[task.role]} />}
        {task.worktreePath && <Row label="WORKTREE" value={task.worktreePath} />}
        {task.role === 'implementer' && (
          <Row label="ISOLATION" value="WORKTREE" color={ROLE_COLORS.implementer} />
        )}
        <Row label="MODEL" value={task.model ?? 'default'} />
        <Row label="DEPENDENCIES" value={task.dependencies.length > 0 ? task.dependencies.join(', ') : 'none'} />
        {task.retryCount != null && <Row label="RETRIES" value={`${task.retryCount}${task.maxRetries ? '/' + task.maxRetries : ''}`} />}

        {task.description && (
          <Section title="DESCRIPTION">
            <p className="whitespace-pre-wrap" style={{ color: THEME.dim }}>{task.description}</p>
          </Section>
        )}

        {task.files && task.files.length > 0 && (
          <Section title="FILES">
            {task.files.map((f, i) => <p key={i} style={{ color: THEME.dim }}>&gt; {f}</p>)}
          </Section>
        )}

        {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
          <Section title="ACCEPTANCE CRITERIA">
            {task.acceptanceCriteria.map((c, i) => <p key={i} style={{ color: THEME.dim }}>&gt; {c}</p>)}
          </Section>
        )}

        {session && (
          <Section title="SESSION">
            <Row label="ID" value={session.id} />
            <Row label="MODEL" value={session.model} />
            <Row label="STATUS" value={session.status} />
            <Row label="TOKENS" value={`${session.tokenEstimate.toLocaleString()} / ${session.recycleThreshold.toLocaleString()}`} />
            <Row label="UTILIZATION" value={`${(session.utilization * 100).toFixed(1)}%`}
              color={session.utilization > 0.75 ? THEME.fadedRed : session.utilization > 0.5 ? THEME.amber : THEME.decayGreen} />
          </Section>
        )}

        {taskDecisions.length > 0 && (
          <Section title="DECISIONS">
            {taskDecisions.map(d => (
              <div key={d.id} className="mb-2 pl-2 border-l" style={{ borderColor: THEME.border }}>
                <p style={{ color: THEME.amber }}>&gt; {d.summary}</p>
                <p style={{ color: THEME.dim }}>{d.rationale}</p>
                {d.affectedFiles.length > 0 && (
                  <p className="text-[9px]" style={{ color: THEME.dim }}>
                    files: {d.affectedFiles.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </Section>
        )}
      </div>
    </motion.div>
  );
}

export function AgentFlowChart({ mission, tasks, sessions, decisions = [] }: AgentFlowChartProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const sessionMap = useMemo(() => new Map(sessions.map(s => [s.taskId, s])), [sessions]);
  const columns = useMemo(() => buildDepthColumns(tasks), [tasks]);
  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  if (tasks.length === 0 && !mission) {
    return (
      <div className="p-8 border rounded text-center"
        style={{ borderColor: THEME.border, backgroundColor: THEME.panelBg, color: THEME.dim }}>
        <p className="text-sm font-mono">No active mission</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded overflow-x-auto" style={{ borderColor: THEME.border, backgroundColor: THEME.bg }}>
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs uppercase tracking-wider font-mono" style={{ color: THEME.dim }}>Agent Flow</span>
        <span className="text-xs font-mono" style={{ color: THEME.dim }}>
          {tasks.length} tasks / {sessions.filter(s => s.status === 'running').length} active
          {selectedTaskId && <span style={{ color: THEME.amber }}> &middot; {selectedTaskId}</span>}
        </span>
      </div>

      <div className="flex gap-6">
        <div className="flex flex-col items-center gap-0 flex-1 min-w-0">
          {mission && (<><MissionNode mission={mission} /><FlowArrow color={THEME.rust} /></>)}
          <AnimatePresence>
            {columns.map((col, ci) => (
              <div key={col.depth} className="flex flex-col items-center gap-0">
                {ci > 0 && <FlowArrow color={THEME.dim} />}
                <div className="flex gap-4 justify-center flex-wrap">
                  {col.tasks.map(task => (
                    <TaskNode key={task.id} task={task} session={sessionMap.get(task.id)}
                      isSelected={task.id === selectedTaskId}
                      onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)} />
                  ))}
                </div>
              </div>
            ))}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {selectedTask && (
            <DetailPanel task={selectedTask} session={sessionMap.get(selectedTask.id)}
              decisions={decisions} onClose={() => setSelectedTaskId(null)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MissionNode({ mission }: { mission: MissionSnapshot }) {
  return (
    <div className="rounded border p-3 w-52 text-center"
      style={{ borderColor: THEME.rust + '60', backgroundColor: THEME.panelBg, color: THEME.amber }}>
      <p className="text-[9px] uppercase tracking-wider mb-1 font-mono" style={{ color: THEME.dim }}>MISSION</p>
      <p className="text-xs font-mono truncate" title={mission.name}>{mission.name || mission.id}</p>
      <p className="text-[9px] mt-1 font-mono" style={{ color: THEME.dim }}>
        {mission.completedTasks}/{mission.taskCount} tasks
      </p>
    </div>
  );
}
