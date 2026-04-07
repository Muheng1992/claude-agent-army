import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { MissionSnapshot } from '../types';
import { STATUS_COLORS } from '../types';

function parseMissionsFromState(snapshot: Record<string, unknown>): MissionSnapshot[] {
  if (!snapshot || !snapshot.missions) return [];

  return (snapshot.missions as Array<Record<string, unknown>>).map(
    (m: Record<string, unknown>) => {
      const mission = m.mission as Record<string, unknown>;
      const tasks = m.tasks as Array<Record<string, unknown>>;
      const sessions = m.sessions as Array<Record<string, unknown>>;
      return {
        id: mission.id as string,
        name: mission.name as string,
        status: mission.status as MissionSnapshot['status'],
        taskCount: (mission.taskIds as string[])?.length ?? tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        sessionCount: sessions.length,
      };
    }
  );
}

function MissionCard({ mission }: { mission: MissionSnapshot }) {
  const color = STATUS_COLORS[mission.status] ?? '#5a5248';
  const pct = mission.taskCount > 0
    ? Math.round((mission.completedTasks / mission.taskCount) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Link
        to={`/mission/${mission.id}`}
        className="block p-5 border rounded border-rust-dark bg-abyss/80 hover:border-rust-mid transition-colors no-underline group"
        style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-text-bright font-bold truncate m-0 group-hover:text-patina-gold transition-colors">
            {mission.name}
          </h3>
          <span
            className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border shrink-0 ml-3"
            style={{ color, borderColor: color + '40', backgroundColor: color + '10' }}
          >
            {mission.status}
          </span>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-text-dim mb-1">
            <span>Progress</span>
            <span>{mission.completedTasks}/{mission.taskCount} ({pct}%)</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-rust-dark overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #1a1410, #c4956a)',
              }}
            />
          </div>
        </div>

        <div className="flex gap-6 text-[10px]">
          <div>
            <span className="text-text-dim block">Tasks</span>
            <span className="text-neon-fade-cyan font-bold">{mission.taskCount}</span>
          </div>
          <div>
            <span className="text-text-dim block">Sessions</span>
            <span className="text-neon-fade-pink font-bold">{mission.sessionCount}</span>
          </div>
          <div>
            <span className="text-text-dim block">ID</span>
            <span className="text-text-dim font-mono">{mission.id.slice(0, 12)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function MissionListPage() {
  const [missions, setMissions] = useState<MissionSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/state')
      .then(r => r.json())
      .then((snapshot) => {
        setMissions(parseMissionsFromState(snapshot));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-lg text-text-bright font-bold tracking-wider m-0 mb-1">
            MISSION ARCHIVE
          </h2>
          <p className="text-[10px] text-text-dim uppercase tracking-wider m-0">
            {missions.length} missions on record
          </p>
        </div>

        <span className="text-[10px] text-text-dim font-mono">
          use /daemon mission to create
        </span>
      </div>

      {isLoading && (
        <div className="text-center py-16">
          <p className="text-text-dim text-sm" style={{ animation: 'flicker 2s infinite' }}>
            LOADING RECORDS...
          </p>
        </div>
      )}

      {!isLoading && missions.length === 0 && (
        <div
          className="text-center py-16 border rounded border-rust-dark bg-abyss/40"
          style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)' }}
        >
          <p className="text-text-dim text-sm mb-2">No missions found</p>
          <p className="text-[10px] text-text-dim font-mono">
            run /daemon mission in Claude Code CLI
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <AnimatePresence>
          {missions.map(mission => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
