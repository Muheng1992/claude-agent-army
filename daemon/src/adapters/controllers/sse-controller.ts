// src/adapters/controllers/sse-controller.ts
// WHY: SSE 端點讓 Dashboard 即時接收事件；/api/state 提供初始狀態快照

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { DaemonEvent } from '../../domain/daemon-event.js';

// CONTEXT: 透過 interface 接收 EventBus，避免 adapter 直接依賴 infrastructure

type EventHandler = (event: DaemonEvent) => void;

export interface EventBusReadPort {
  subscribe(handler: EventHandler): void;
  unsubscribe(handler: EventHandler): void;
  getRecentEvents(): readonly DaemonEvent[];
  getSubscriberCount(): number;
}

export interface StateSnapshotPort {
  getSnapshot(): Promise<DashboardState>;
}

interface DashboardState {
  readonly missions: Array<{
    readonly mission: Record<string, unknown>;
    readonly tasks: Record<string, unknown>[];
    readonly sessions: Record<string, unknown>[];
    readonly artifacts: Record<string, unknown>[];
    readonly decisions: Record<string, unknown>[];
  }>;
  readonly daemon: {
    readonly uptime: number;
    readonly version: string;
    readonly eventBusSubscribers: number;
  };
}

export interface SseControllerDeps {
  eventBus: EventBusReadPort;
  stateSnapshot: StateSnapshotPort;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

export function createSseRouter(deps: SseControllerDeps): Router {
  const router = Router();

  router.get('/events', handleSseStream(deps));
  router.get('/dashboard', handleDashboard());
  router.get('/api/state', handleStateSnapshot(deps));

  return router;
}

function handleSseStream(deps: SseControllerDeps) {
  return (req: Request, res: Response): void => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // WHY: 每 30 秒送出 comment 避免 proxy 或瀏覽器判斷連線超時
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, HEARTBEAT_INTERVAL_MS);

    for (const event of deps.eventBus.getRecentEvents()) {
      writeSseEvent(res, event);
    }

    const handler: EventHandler = (event) => {
      writeSseEvent(res, event);
    };
    deps.eventBus.subscribe(handler);

    req.on('close', () => {
      clearInterval(heartbeat);
      deps.eventBus.unsubscribe(handler);
    });
  };
}

function handleDashboard() {
  // WHY: 舊的 /dashboard 路由重導至 React dashboard，保持向後相容
  return (_req: Request, res: Response): void => {
    res.redirect(301, '/dashboard/');
  };
}

function handleStateSnapshot(deps: SseControllerDeps) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const state = await deps.stateSnapshot.getSnapshot();
      res.json(state);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message, code: 'STATE_SNAPSHOT_ERROR' });
    }
  };
}

function writeSseEvent(res: Response, event: DaemonEvent): void {
  res.write(`id: ${event.id}\n`);
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
