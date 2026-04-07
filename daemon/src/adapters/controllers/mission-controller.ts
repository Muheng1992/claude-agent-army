// src/adapters/controllers/mission-controller.ts
// WHY: REST 控制器，薄層委派給 use cases

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { StartMissionUseCase } from '../../application/use-cases/start-mission.js';
import type { CheckHealthUseCase } from '../../application/use-cases/check-health.js';
import type { MissionRepositoryPort, TaskRepositoryPort } from '../../application/ports/mission-repository-port.js';
import type { ContextLedgerPort } from '../../application/ports/context-ledger-port.js';
import type { SessionManagerPort } from '../../application/ports/session-manager-port.js';
import type { PersistencePort } from '../../application/ports/persistence-port.js';

export interface MissionControllerDeps {
  startMission: StartMissionUseCase;
  checkHealth: CheckHealthUseCase;
  missionRepo: MissionRepositoryPort;
  taskRepo: TaskRepositoryPort;
  contextLedger: ContextLedgerPort;
  sessionManager: SessionManagerPort;
  dataDir: string;
  persistence: PersistencePort;
}

export function createMissionRouter(deps: MissionControllerDeps): Router {
  const router = Router();

  router.post('/', handleCreateMission(deps));
  // WHY: /history 必須在 /:id 之前註冊，否則 Express 會把 "history" 當成 :id
  router.get('/history', handleGetHistory(deps));
  router.get('/:id', handleGetMission(deps));
  router.get('/:id/tasks', handleGetTasks(deps));
  router.get('/:id/sessions', handleGetSessions(deps));
  router.get('/:id/decisions', handleGetDecisions(deps));
  router.get('/:id/ledger', handleGetLedger(deps));
  router.delete('/:id', handleDeleteMission(deps));

  return router;
}

function handleCreateMission(deps: MissionControllerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await deps.startMission.execute(req.body);
      res.status(201).json(result);
    } catch (err) {
      sendError(res, err);
    }
  };
}

function handleGetMission(deps: MissionControllerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const mission = await deps.missionRepo.findById(getParamId(req));
      if (!mission) {
        res.status(404).json({ error: 'Mission not found', code: 'MISSION_NOT_FOUND' });
        return;
      }
      const tasks = await deps.taskRepo.findByMissionId(getParamId(req));
      const ledger = await deps.contextLedger.load(getParamId(req));
      const completedTasks = tasks.filter((t) => t.status === 'completed').length;
      const activeSessions = ledger.sessions.filter((s) => s.status === 'running').length;
      const totalTokens = ledger.sessions.reduce((sum, s) => sum + s.tokenEstimate, 0);

      res.json({
        mission,
        progress: {
          completedTasks,
          totalTasks: tasks.length,
          activeSessions,
          totalTokensConsumed: totalTokens,
        },
      });
    } catch (err) {
      sendError(res, err);
    }
  };
}

function handleGetTasks(deps: MissionControllerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const tasks = await deps.taskRepo.findByMissionId(getParamId(req));
      const readyTasks = tasks
        .filter((t) => t.status === 'pending')
        .filter((t) =>
          t.dependencies.every((depId) =>
            tasks.find((d) => d.id === depId)?.status === 'completed'
          )
        )
        .map((t) => t.id);

      const isTerminal = tasks.every(
        (t) => t.status === 'completed' || t.status === 'abandoned' || t.status === 'failed'
      );

      res.json({ tasks, graph: { readyTasks, isTerminal } });
    } catch (err) {
      sendError(res, err);
    }
  };
}

function handleGetSessions(deps: MissionControllerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const ledger = await deps.contextLedger.load(getParamId(req));
      const sessions = await Promise.all(
        ledger.sessions.map(async (s) => ({
          ...s,
          processAlive: false,
          tokenUtilization: 0,
        }))
      );
      res.json({ sessions });
    } catch (err) {
      sendError(res, err);
    }
  };
}

function handleGetLedger(deps: MissionControllerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const ledger = await deps.contextLedger.load(getParamId(req));
      res.json({
        ledger,
        stats: {
          totalArtifacts: ledger.artifacts.length,
          totalDecisions: ledger.decisions.length,
          totalSessions: ledger.sessions.length,
        },
      });
    } catch (err) {
      sendError(res, err);
    }
  };
}

function handleGetDecisions(deps: MissionControllerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const ledger = await deps.contextLedger.load(getParamId(req));
      res.json({ decisions: ledger.decisions });
    } catch (err) {
      sendError(res, err);
    }
  };
}

function handleGetHistory(deps: MissionControllerDeps) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const { join } = await import('node:path');
      const missionsDir = join(deps.dataDir, 'missions');
      const entries = await deps.persistence.listFiles(missionsDir);

      // WHY: 每個 mission 目錄下有 mission.json，讀取並回傳摘要
      const summaries = await Promise.all(
        entries.map(async (entryPath) => {
          const missionFile = join(entryPath, 'mission.json');
          const hasFile = await deps.persistence.exists(missionFile);
          if (!hasFile) return null;
          return deps.persistence.readJson<Record<string, unknown>>(missionFile);
        })
      );

      const missions = summaries.filter(Boolean);
      res.json({ missions });
    } catch (err) {
      sendError(res, err);
    }
  };
}

function handleDeleteMission(deps: MissionControllerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const mission = await deps.missionRepo.findById(getParamId(req));
      if (!mission) {
        res.status(404).json({ error: 'Mission not found', code: 'MISSION_NOT_FOUND' });
        return;
      }
      // Kill all running sessions
      const pids = await deps.sessionManager.getRunningProcessIds();
      for (const pid of pids) {
        await deps.sessionManager.kill(pid);
      }
      await deps.missionRepo.updateStatus(getParamId(req), 'cancelled');
      res.json({
        missionId: getParamId(req),
        killedSessions: pids.length,
        finalStatus: 'cancelled',
      });
    } catch (err) {
      sendError(res, err);
    }
  };
}

/** Express v5 params 可能為 string | string[]，統一取 string */
function getParamId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function sendError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Unknown error';
  const code = (err as { code?: string })?.code ?? 'INTERNAL_ERROR';
  res.status(500).json({ error: message, code });
}
