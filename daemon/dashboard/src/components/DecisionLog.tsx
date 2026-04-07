// WHY: Terminal-style decision log showing rationale and affected files per task

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Decision } from '../types';

const THEME = {
  amber: '#c8a050',
  dim: '#6a6a5a',
  bg: '#0a0a08',
  panelBg: '#12110e',
  border: '#2a2820',
  rust: '#c8603c',
} as const;

interface DecisionLogProps {
  decisions: Decision[];
}

interface GroupedDecisions {
  taskId: string;
  items: Decision[];
}

function groupByTask(decisions: Decision[]): GroupedDecisions[] {
  const map = new Map<string, Decision[]>();

  for (const d of decisions) {
    if (!map.has(d.taskId)) map.set(d.taskId, []);
    map.get(d.taskId)!.push(d);
  }

  return Array.from(map.entries())
    .map(([taskId, items]) => ({
      taskId,
      items: items.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    }))
    .sort((a, b) => a.taskId.localeCompare(b.taskId));
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

function DecisionCard({ decision }: { decision: Decision }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="font-mono text-xs leading-relaxed mb-3"
      style={{ color: THEME.amber }}
    >
      <div className="flex items-start gap-2">
        <span style={{ color: THEME.rust }}>&gt;</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px]" style={{ color: THEME.dim }}>
              [{formatTime(decision.createdAt)}]
            </span>
            <span className="text-[9px]" style={{ color: THEME.dim }}>
              s-{decision.sessionId.slice(-6)}
            </span>
          </div>

          <p style={{ color: THEME.amber }}>&gt; {decision.summary}</p>

          <p className="mt-0.5" style={{ color: THEME.dim }}>
            &gt; rationale: {decision.rationale}
          </p>

          {decision.affectedFiles.length > 0 && (
            <div className="mt-0.5" style={{ color: THEME.dim }}>
              <span>&gt; files:</span>
              {decision.affectedFiles.map((f, i) => (
                <span key={i} className="ml-2 block">
                  &gt;   {f}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function DecisionLog({ decisions }: DecisionLogProps) {
  const groups = useMemo(() => groupByTask(decisions), [decisions]);

  if (decisions.length === 0) {
    return (
      <div
        className="p-6 border rounded text-center"
        style={{
          borderColor: THEME.border,
          backgroundColor: THEME.panelBg,
          color: THEME.dim,
        }}
      >
        <p className="text-sm font-mono">No decisions recorded</p>
      </div>
    );
  }

  return (
    <div
      className="border rounded overflow-hidden"
      style={{ borderColor: THEME.border, backgroundColor: THEME.bg }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: THEME.border }}
      >
        <span className="text-xs uppercase tracking-wider font-mono" style={{ color: THEME.dim }}>
          Decision Log
        </span>
        <span className="text-xs font-mono" style={{ color: THEME.dim }}>
          {decisions.length} decisions
        </span>
      </div>

      <div className="p-4 max-h-80 overflow-y-auto">
        <AnimatePresence>
          {groups.map(group => (
            <div key={group.taskId} className="mb-4 last:mb-0">
              <div
                className="text-[10px] uppercase tracking-wider font-mono mb-2 pb-1 border-b"
                style={{
                  color: THEME.rust,
                  borderColor: THEME.border,
                }}
              >
                Task: {group.taskId.slice(-8)}
              </div>
              {group.items.map(d => (
                <DecisionCard key={d.id} decision={d} />
              ))}
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
