// src/infrastructure/main.ts
// WHY: DI 組裝進入點 — 建立所有 ports/adapters/use cases，啟動 server
// AI-CAUTION: 此檔案是 orchestration 核心，修改會影響所有 session 生命週期

import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { createApp, startServer, stopServer } from './server.js';
import { installHooks, uninstallHooks } from './hooks-installer.js';
import { EventBus } from './event-bus.js';
import { sessionRegistry, assignReadyTasks, type OrchestratorDeps } from './orchestrator.js';
import { FilePersistence } from '../adapters/file-persistence.js';
import { FileContextStore } from '../adapters/file-context-store.js';
import {
  FileMissionRepository,
  FileTaskRepository,
} from '../adapters/file-task-store.js';
import { SessionSpawner } from '../adapters/session-spawner.js';
import { GitCheckpoint } from '../adapters/git-checkpoint.js';
import { StartMissionUseCase } from '../application/use-cases/start-mission.js';
import { AssignTaskUseCase } from '../application/use-cases/assign-task.js';
import { HandleHookEventUseCase } from '../application/use-cases/handle-hook-event.js';
import { RecycleSessionUseCase } from '../application/use-cases/recycle-session.js';
import { CheckHealthUseCase } from '../application/use-cases/check-health.js';
import { VerifyTaskUseCase } from '../application/use-cases/verify-task.js';
import { ReplanUseCase } from '../application/use-cases/replan.js';
import { createMissionRouter } from '../adapters/controllers/mission-controller.js';
import { createHookRouter } from '../adapters/controllers/hook-controller.js';
import { createSseRouter } from '../adapters/controllers/sse-controller.js';
import { createDaemonEvent } from '../domain/daemon-event.js';
import type { RecycleSessionInput } from '../application/use-cases/recycle-session.js';

export { sessionRegistry };

export async function startDaemon(): Promise<void> {
  const config = loadConfig();
  const dataDir = resolve(config.projectRoot, config.dataDir);

  console.log('[daemon] Starting with config:', {
    port: config.port,
    dataDir,
    projectRoot: config.projectRoot,
    defaultModel: config.models.defaultModel,
  });

  // Adapters
  const persistence = new FilePersistence();
  await persistence.ensureDir(dataDir);

  const contextLedger = new FileContextStore(dataDir, persistence);
  const missionRepo = new FileMissionRepository(dataDir, persistence);
  const taskRepo = new FileTaskRepository(dataDir, persistence);
  const sessionManager = new SessionSpawner(config.projectRoot);
  const _gitCheckpoint = new GitCheckpoint(config.projectRoot);

  // Infrastructure
  const eventBus = new EventBus();

  // Use Cases
  const startMission = new StartMissionUseCase({
    missionRepo,
    taskRepo,
    ledgerPort: contextLedger,
    eventBus,
  });

  const assignTask = new AssignTaskUseCase({
    missionRepo,
    taskRepo,
    sessionManager,
    ledgerPort: contextLedger,
    eventBus,
    projectRoot: config.projectRoot,
  });

  const replan = new ReplanUseCase({
    taskRepo,
    missionRepo,
    eventBus,
  });

  const recycleSession = new RecycleSessionUseCase({
    sessionManager,
    ledgerPort: contextLedger,
    taskRepo,
    assignTask,
    sessionRegistry,
    eventBus,
  });

  const _verifyTask = new VerifyTaskUseCase({
    taskRepo,
    ledgerPort: contextLedger,
  });

  const orchestratorDeps: OrchestratorDeps = { assignTask, taskRepo };

  // WHY: Orchestration 回呼定義在 infrastructure 層，避免 use case 之間直接耦合
  const onTaskCompleted = async (missionId: string, taskId: string): Promise<void> => {
    const registered = sessionRegistry.findByTaskId(taskId);
    if (registered) {
      // WHY: implementer 完成後需合併 worktree 分支並清理
      if (sessionManager.hasWorktree(registered.sessionId)) {
        const merged = await sessionManager.mergeWorktree(registered.sessionId);
        if (merged) {
          console.log(`[orchestrator] Merged worktree for session ${registered.sessionId}`);
        }
        await sessionManager.cleanupWorktree(registered.sessionId);
      }
      sessionRegistry.unregister(registered.sessionId);
    }

    console.log(`[orchestrator] Task ${taskId} completed, checking for ready tasks`);
    await assignReadyTasks(missionId, orchestratorDeps);

    // WHY: 檢查 mission 是否全部完成
    const tasks = await taskRepo.findByMissionId(missionId);
    const allDone = tasks.every(
      (t) => t.status === 'completed' || t.status === 'abandoned'
    );
    if (allDone) {
      const allCompleted = tasks.every((t) => t.status === 'completed');
      const finalStatus = allCompleted ? 'completed' : 'failed';
      await missionRepo.updateStatus(missionId, finalStatus);

      const completedCount = tasks.filter((t) => t.status === 'completed').length;
      if (allCompleted) {
        eventBus.emit(
          createDaemonEvent('mission:completed', {
            missionId,
            completedTasks: completedCount,
            totalTasks: tasks.length,
          })
        );
      } else {
        eventBus.emit(
          createDaemonEvent('mission:failed', {
            missionId,
            reason: `${tasks.length - completedCount} task(s) not completed`,
          })
        );
      }
    }
  };

  const onRecycleNeeded = async (sessionId: string, reason: string): Promise<void> => {
    const entry = sessionRegistry.findBySessionId(sessionId);
    if (!entry) {
      console.warn(`[orchestrator] Cannot recycle unknown session: ${sessionId}`);
      return;
    }

    try {
      const result = await recycleSession.execute({
        missionId: entry.missionId,
        sessionId,
        reason: reason as RecycleSessionInput['reason'],
      });

      sessionRegistry.unregister(sessionId);
      sessionRegistry.register({
        sessionId: result.newSessionId,
        missionId: entry.missionId,
        taskId: entry.taskId,
        model: entry.model,
        processId: result.newProcessId,
        status: 'running',
        lastHeartbeatAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[orchestrator] Recycle failed for ${sessionId}: ${msg}`);
    }
  };

  const handleHookEvent = new HandleHookEventUseCase({
    ledgerPort: contextLedger,
    taskRepo,
    sessionRegistry,
    eventBus,
    onRecycleNeeded,
    onTaskCompleted,
  });

  const checkHealth = new CheckHealthUseCase({
    missionRepo,
    taskRepo,
    ledgerPort: contextLedger,
    sessionManager,
    sessionRegistry,
    eventBus,
  });

  // Controllers
  const missionRouter = createMissionRouter({
    startMission,
    checkHealth,
    missionRepo,
    taskRepo,
    contextLedger,
    sessionManager,
    dataDir,
    persistence,
  });

  const hookRouter = createHookRouter({ handleHookEvent });

  // SSE Controller — provides /events, /dashboard, /api/state
  const startedAt = Date.now();
  const sseRouter = createSseRouter({
    eventBus,
    stateSnapshot: {
      async getSnapshot() {
        const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
        // WHY: 從檔案系統讀取所有 missions，而不是回傳空陣列
        const missionSnapshots = [];
        const missionsDir = `${config.dataDir}/missions`;
        try {
          const { readdir } = await import('node:fs/promises');
          const dirs = await readdir(missionsDir).catch(() => [] as string[]);
          for (const dir of dirs) {
            const mission = await persistence.readJson<Record<string, unknown>>(`${missionsDir}/${dir}/mission.json`);
            if (!mission) continue;
            const tasks = await persistence.readJson<Record<string, unknown>[]>(`${missionsDir}/${dir}/tasks.json`) ?? [];
            const ledger = await persistence.readJson<Record<string, unknown>>(`${missionsDir}/${dir}/ledger.json`);
            missionSnapshots.push({
              mission,
              tasks,
              sessions: ledger && Array.isArray((ledger as any).sessions) ? (ledger as any).sessions : [],
              artifacts: ledger && Array.isArray((ledger as any).artifacts) ? (ledger as any).artifacts : [],
              decisions: ledger && Array.isArray((ledger as any).decisions) ? (ledger as any).decisions : [],
            });
          }
        } catch { /* data dir may not exist yet */ }
        return {
          missions: missionSnapshots,
          daemon: {
            uptime: uptimeSeconds,
            version: '0.3.0',
            eventBusSubscribers: eventBus.getSubscriberCount(),
          },
        };
      },
    },
  });

  // Server
  const app = createApp({
    missionRouter,
    hookRouter,
    sseRouter,
    eventBus,
    sessionRegistry,
  });
  await startServer(app, config.port);

  // Install hooks
  await installHooks(config.projectRoot, config.port, persistence);

  // WHY: 每 5 分鐘掃描所有 running missions，偵測卡住的 tasks 並自動重新分派
  const { startScheduler, stopScheduler } = await import('./heartbeat.js');
  startScheduler(5 * 60 * 1000, {
    checkHealth,
    persistence,
    taskRepo,
    assignTask,
    dataDir,
  });

  // Graceful shutdown
  setupShutdown(config.projectRoot, sessionManager, persistence, stopScheduler);

  // WHY: Mission 建立後自動啟動 ready tasks — 透過 event bus 監聯並行指派
  eventBus.subscribe(async (event) => {
    if (event.type === 'mission:started') {
      const missionId = event.payload.missionId;
      try {
        await assignReadyTasks(missionId, orchestratorDeps);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[orchestrator] Auto-assign failed: ${msg}`);
      }
    }
  });

  // WHY: 保留 replan use case 的引用避免被 tree-shake
  void replan;
}

function setupShutdown(
  projectRoot: string,
  sessionManager: SessionSpawner,
  persistence: FilePersistence,
  stopScheduler?: () => void
): void {
  const shutdown = async (signal: string) => {
    console.log(`[daemon] Received ${signal}, shutting down...`);

    stopScheduler?.();

    const pids = await sessionManager.getRunningProcessIds();
    for (const pid of pids) {
      await sessionManager.kill(pid);
    }

    await uninstallHooks(projectRoot, persistence);
    await stopServer();

    console.log('[daemon] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

// WHY: 直接執行時啟動 daemon
startDaemon().catch((err) => {
  console.error('[daemon] Failed to start:', err);
  process.exit(1);
});
