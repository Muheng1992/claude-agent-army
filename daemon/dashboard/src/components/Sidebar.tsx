import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { MissionSnapshot, SessionSnapshot, AgentRole } from '../types';
import { STATUS_COLORS, ROLE_COLORS } from '../types';

interface SidebarProps {
  mission?: MissionSnapshot;
  sessions: SessionSnapshot[];
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#5a5248';
  return (
    <span
      className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border"
      style={{ color, borderColor: color + '40', backgroundColor: color + '10' }}
    >
      {status}
    </span>
  );
}

function ProgressBar({ value, max, gradient }: { value: number; max: number; gradient?: boolean }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const bg = gradient
    ? 'linear-gradient(90deg, #1a1410, #8b6a2a 60%, #cc3333)'
    : 'linear-gradient(90deg, #1a1410, #c4956a)';

  return (
    <div className="h-1.5 w-full rounded-full bg-rust-dark overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: bg }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
}

function MissionPanel({ mission }: { mission: MissionSnapshot }) {
  return (
    <div className="p-4 border rounded border-rust-dark bg-abyss/80" style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-dim uppercase tracking-wider">Mission</span>
        <StatusBadge status={mission.status} />
      </div>
      <p className="text-sm text-text-primary mb-2 truncate" title={mission.name}>
        {mission.name}
      </p>

      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-text-dim mb-1">
          <span>Progress</span>
          <span>{mission.completedTasks}/{mission.taskCount}</span>
        </div>
        <ProgressBar value={mission.completedTasks} max={mission.taskCount} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="text-text-dim block">Tasks</span>
          <span className="text-neon-fade-cyan text-sm font-bold">{mission.taskCount}</span>
        </div>
        <div>
          <span className="text-text-dim block">Sessions</span>
          <span className="text-neon-fade-pink text-sm font-bold">{mission.sessionCount}</span>
        </div>
      </div>
    </div>
  );
}

function SessionRoleBadge({ role }: { role: AgentRole }) {
  const color = ROLE_COLORS[role];
  return (
    <span
      className="px-1.5 py-0.5 text-[8px] uppercase tracking-wider rounded border font-mono"
      style={{ color, borderColor: color + '40', backgroundColor: color + '10' }}
    >
      {role}
    </span>
  );
}

function SessionCard({ session }: { session: SessionSnapshot }) {
  const isActive = session.status === 'running' || session.status === 'spawning';

  return (
    <motion.div
      layoutId={`session-${session.id}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={clsx(
        'p-3 border rounded bg-abyss/60',
        isActive ? 'border-neon-fade-pink/40' : 'border-rust-dark'
      )}
      style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.4)' }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-neon-fade-pink font-bold">
          {session.id.slice(-8)}
        </span>
        <div className="flex items-center gap-1.5">
          {session.role && <SessionRoleBadge role={session.role} />}
          <StatusBadge status={session.status} />
        </div>
      </div>
      <p className="text-[10px] text-text-dim mb-1 truncate">{session.model}</p>
      <p className="text-[10px] text-text-dim mb-2 truncate">
        Task: {session.taskId.slice(-8)}
      </p>

      <div>
        <div className="flex justify-between text-[10px] text-text-dim mb-1">
          <span>Tokens</span>
          <span>{Math.round(session.utilization * 100)}%</span>
        </div>
        <ProgressBar value={session.tokenEstimate} max={session.recycleThreshold} gradient />
      </div>
    </motion.div>
  );
}

export function Sidebar({ mission, sessions }: SidebarProps) {
  const activeSessions = sessions.filter(s => s.status === 'running' || s.status === 'spawning');

  return (
    <aside className="flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-5rem)]">
      {mission && <MissionPanel mission={mission} />}

      <div className="p-4 border rounded border-rust-dark bg-abyss/80" style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-text-dim uppercase tracking-wider">Sessions</span>
          <span className="text-xs text-neon-fade-pink font-bold">{activeSessions.length}</span>
        </div>

        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {sessions.map(session => (
              <SessionCard key={session.id} session={session} />
            ))}
          </AnimatePresence>
        </div>

        {sessions.length === 0 && (
          <p className="text-[10px] text-text-dim text-center py-4">
            No sessions active
          </p>
        )}
      </div>
    </aside>
  );
}
