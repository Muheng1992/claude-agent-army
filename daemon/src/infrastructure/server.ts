// src/infrastructure/server.ts
// WHY: Express server 設定，掛載 controllers 與中間件

import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'node:http';
import type { Router } from 'express';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EventBus } from './event-bus.js';
import type { InMemorySessionRegistry } from './session-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ServerDeps {
  missionRouter: Router;
  hookRouter: Router;
  // AI-BOUNDARY: SSE router 為選配，dashboard 未啟用時不掛載
  sseRouter?: Router;
  eventBus?: EventBus;
  sessionRegistry?: InMemorySessionRegistry;
}

let server: Server | null = null;

const startedAt = Date.now();

export function createApp(deps: ServerDeps): Express {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // WHY: CORS headers 讓本地開發時 dashboard 可從不同 port 存取 API
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // Health endpoint
  app.get('/health', (_req: Request, res: Response) => {
    const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
    res.json({
      status: 'ok',
      uptime: uptimeSeconds,
      activeSessions: deps.sessionRegistry?.getActiveCount() ?? 0,
      eventBusSubscribers: deps.eventBus?.getSubscriberCount() ?? 0,
      version: '0.2.0',
    });
  });

  // Mount controllers
  app.use('/missions', deps.missionRouter);
  app.use('/hooks', deps.hookRouter);

  // WHY: 提供 React dashboard 靜態檔案，base path 與 Vite config 一致
  // AI-CAUTION: 必須在 SSE router 之前掛載，否則 SSE 的 /dashboard 路由會攔截
  const dashboardDir = resolve(__dirname, 'public/dashboard-dist');
  app.use('/dashboard', express.static(dashboardDir));

  // WHY: SPA fallback — 所有 /dashboard 子路徑未匹配的路由都回傳 index.html
  app.get('/dashboard/{*splat}', (_req: Request, res: Response) => {
    res.sendFile(resolve(dashboardDir, 'index.html'));
  });

  // Mount SSE routes when provided (after dashboard static, before error handler)
  if (deps.sseRouter) {
    app.use('/', deps.sseRouter);
  }

  // Error handling middleware
  app.use(
    (err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[server] Unhandled error:', err.message);
      res.status(500).json({
        error: err.message,
        code: 'INTERNAL_ERROR',
      });
    }
  );

  return app;
}

export function startServer(
  app: Express,
  port: number
): Promise<Server> {
  return new Promise((resolve, reject) => {
    try {
      server = app.listen(port, () => {
        console.log(`[daemon] Server listening on port ${port}`);
        resolve(server!);
      });
      server.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close((err) => {
      server = null;
      if (err) reject(err);
      else resolve();
    });
  });
}
