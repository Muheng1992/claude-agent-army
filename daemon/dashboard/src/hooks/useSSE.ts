import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  DaemonEvent,
  DashboardState,
  Decision,
  MissionSnapshot,
  SessionSnapshot,
  TokenDataPoint,
} from '../types';

const MAX_EVENTS = 200;
const MAX_TOKEN_HISTORY = 120;

function createEmptyState(): DashboardState {
  return { missions: [], tasks: [], sessions: [], decisions: [], tokenHistory: [] };
}

function updateStateFromEvent(
  event: DaemonEvent,
  prev: DashboardState
): DashboardState {
  const { type, payload, timestamp } = event;
  const p = payload as Record<string, unknown>;

  switch (type) {
    case 'mission:started': {
      const mission: MissionSnapshot = {
        id: p.missionId as string,
        name: p.name as string,
        status: 'running',
        taskCount: p.taskCount as number,
        completedTasks: 0,
        sessionCount: 0,
      };
      return { ...prev, missions: [...prev.missions, mission] };
    }

    case 'mission:completed':
    case 'mission:failed':
    case 'mission:cancelled': {
      const status = type === 'mission:completed' ? 'completed'
        : type === 'mission:failed' ? 'failed' : 'cancelled';
      return {
        ...prev,
        missions: prev.missions.map(m =>
          m.id === p.missionId ? { ...m, status } : m
        ),
      };
    }

    case 'task:started': {
      const existing = prev.tasks.find(t => t.id === p.taskId);
      if (existing) {
        return {
          ...prev,
          tasks: prev.tasks.map(t =>
            t.id === p.taskId
              ? { ...t, status: 'running', title: (p.title as string) || t.title }
              : t
          ),
        };
      }
      return {
        ...prev,
        tasks: [...prev.tasks, {
          id: p.taskId as string,
          title: p.title as string,
          status: 'running',
          dependencies: [],
        }],
      };
    }

    case 'task:assigned':
      return {
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === p.taskId
            ? { ...t, status: 'assigned', sessionId: p.sessionId as string, model: p.model as string }
            : t
        ),
      };

    case 'task:completed':
      return {
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === p.taskId ? { ...t, status: 'completed' } : t
        ),
        missions: prev.missions.map(m =>
          m.id === p.missionId
            ? { ...m, completedTasks: m.completedTasks + 1 }
            : m
        ),
      };

    case 'task:failed':
      return {
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === p.taskId ? { ...t, status: 'failed' } : t
        ),
      };

    case 'task:retrying':
      return {
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === p.taskId
            ? { ...t, status: 'retrying', retryCount: p.retryCount as number, maxRetries: p.maxRetries as number }
            : t
        ),
      };

    case 'task:abandoned':
      return {
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === p.taskId ? { ...t, status: 'abandoned' } : t
        ),
      };

    case 'session:spawned': {
      const session: SessionSnapshot = {
        id: p.sessionId as string,
        taskId: p.taskId as string,
        model: p.model as string,
        status: 'running',
        tokenEstimate: 0,
        recycleThreshold: 200000,
        utilization: 0,
      };
      return {
        ...prev,
        sessions: [...prev.sessions, session],
        missions: prev.missions.map(m =>
          m.id === p.missionId ? { ...m, sessionCount: m.sessionCount + 1 } : m
        ),
      };
    }

    case 'session:token-updated': {
      const timeLabel = new Date(timestamp).toLocaleTimeString('en-US', {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      const sessionId = p.sessionId as string;
      const tokenEstimate = p.tokenEstimate as number;

      const lastPoint = prev.tokenHistory[prev.tokenHistory.length - 1];
      let tokenHistory: TokenDataPoint[];
      if (lastPoint && lastPoint.time === timeLabel) {
        tokenHistory = [
          ...prev.tokenHistory.slice(0, -1),
          { ...lastPoint, [sessionId]: tokenEstimate },
        ];
      } else {
        const newPoint: TokenDataPoint = { time: timeLabel, [sessionId]: tokenEstimate };
        tokenHistory = [...prev.tokenHistory, newPoint].slice(-MAX_TOKEN_HISTORY);
      }

      return {
        ...prev,
        sessions: prev.sessions.map(s =>
          s.id === sessionId
            ? {
                ...s,
                tokenEstimate,
                recycleThreshold: p.recycleThreshold as number,
                utilization: p.utilization as number,
              }
            : s
        ),
        tokenHistory,
      };
    }

    case 'session:recycled':
      return {
        ...prev,
        sessions: prev.sessions.map(s =>
          s.id === p.oldSessionId ? { ...s, status: 'recycling' } : s
        ),
      };

    case 'session:completed':
      return {
        ...prev,
        sessions: prev.sessions.map(s =>
          s.id === p.sessionId ? { ...s, status: 'completed' } : s
        ),
      };

    case 'session:killed':
      return {
        ...prev,
        sessions: prev.sessions.map(s =>
          s.id === p.sessionId ? { ...s, status: 'killed' } : s
        ),
      };

    case 'decision:recorded': {
      const decision: Decision = {
        id: event.id,
        taskId: p.taskId as string,
        sessionId: p.sessionId as string,
        summary: p.summary as string,
        rationale: p.rationale as string,
        affectedFiles: (p.affectedFiles as string[]) ?? [],
        createdAt: event.timestamp,
      };
      return {
        ...prev,
        decisions: [...prev.decisions, decision],
      };
    }

    default:
      return prev;
  }
}

// WHY: missionId 參數用於在多任務路由下只訂閱特定 mission 的事件
export function useSSE(missionId?: string) {
  const [events, setEvents] = useState<DaemonEvent[]>([]);
  const [state, setState] = useState<DashboardState>(createEmptyState);
  const [isConnected, setIsConnected] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const processEvent = useCallback((event: DaemonEvent) => {
    setEvents(prev => [event, ...prev].slice(0, MAX_EVENTS));
    setState(prev => updateStateFromEvent(event, prev));
  }, []);

  useEffect(() => {
    setEvents([]);
    setState(createEmptyState());

    fetch('/api/state')
      .then(r => r.json())
      .then((snapshot) => {
        if (snapshot && snapshot.missions) {
          const missions = (snapshot.missions as Array<Record<string, unknown>>).map(
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
                      } satisfies MissionSnapshot;
            }
          );
          setState(prev => ({ ...prev, missions }));
        }
      })
      .catch(() => {});

    const url = missionId ? `/events?missionId=${missionId}` : '/events';
    const es = new EventSource(url);

    es.onopen = () => setIsConnected(true);
    es.onerror = () => setIsConnected(false);

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as DaemonEvent;
        processEvent(event);
      } catch {
        // WHY: SSE heartbeat comments are not JSON — safe to ignore
      }
    };

    return () => es.close();
  }, [processEvent, missionId]);

  return { events, state, isConnected };
}
