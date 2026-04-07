// src/infrastructure/heartbeat.ts
// WHY: 定時掃描所有 running missions，偵測卡住的 tasks 並自動重新分派

import type { CheckHealthUseCase } from '../application/use-cases/check-health.js';
import type { FilePersistence } from '../adapters/file-persistence.js';
import type { FileTaskRepository } from '../adapters/file-task-store.js';
import { assignReadyTasks, sessionRegistry } from './orchestrator.js';
import type { AssignTaskUseCase } from '../application/use-cases/assign-task.js';

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

interface SchedulerDeps {
  checkHealth: CheckHealthUseCase;
  persistence: FilePersistence;
  taskRepo: FileTaskRepository;
  assignTask: AssignTaskUseCase;
  dataDir: string;
}

// WHY: 掃描 data/missions/ 找出所有 running missions
async function getRunningMissionIds(deps: SchedulerDeps): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const missionsDir = `${deps.dataDir}/missions`;
  const dirs = await readdir(missionsDir).catch(() => [] as string[]);
  const running: string[] = [];

  for (const dir of dirs) {
    const mission = await deps.persistence.readJson<{ status: string }>(
      `${missionsDir}/${dir}/mission.json`
    );
    if (mission && (mission.status === 'running' || mission.status === 'planning')) {
      running.push(dir);
    }
  }
  return running;
}

async function runScheduledCheck(deps: SchedulerDeps): Promise<void> {
  const missionIds = await getRunningMissionIds(deps);
  if (missionIds.length === 0) return;

  for (const missionId of missionIds) {
    try {
      const health = await deps.checkHealth.execute({ missionId });

      // 偵測卡住的 sessions：process 死了但 task 還在 running
      const stuckSessions = health.activeSessions.filter(
        (s) => !s.processAlive && s.status === 'running'
      );

      // 偵測 heartbeat timeout（超過 5 分鐘沒有 hook event）
      const timeoutSessions = health.activeSessions.filter(
        (s) => s.lastHeartbeatAge > 300 && s.processAlive
      );

      if (stuckSessions.length > 0) {
        console.log(
          `[scheduler] Found ${stuckSessions.length} stuck sessions in ${missionId}, reassigning...`
        );
        for (const session of stuckSessions) {
          // 從 registry 移除死掉的 session
          sessionRegistry.unregister(session.sessionId);
          // 將 task 重設為 pending（讓 assignReadyTasks 重新分派）
          const tasks = await deps.taskRepo.findByMissionId(missionId);
          const task = tasks.find((t) => t.id === session.taskId);
          if (task && task.status === 'running') {
            task.status = 'pending' as any;
            await deps.taskRepo.update(missionId, task);
          }
        }
      }

      if (timeoutSessions.length > 0) {
        console.log(
          `[scheduler] Found ${timeoutSessions.length} timed-out sessions in ${missionId}`
        );
        // CONTEXT: Timeout sessions 暫時只記錄警告，不強制 kill（可能是大型工作正在進行）
      }

      // 嘗試填補空位（不管有沒有 stuck，都檢查一次是否有 ready tasks）
      await assignReadyTasks(missionId, {
        assignTask: deps.assignTask,
        taskRepo: deps.taskRepo,
      });

      if (health.warnings.length > 0) {
        for (const w of health.warnings) {
          console.warn(`[scheduler] ${missionId}: ${w}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[scheduler] Health check failed for ${missionId}: ${msg}`);
    }
  }
}

export function startScheduler(
  intervalMs: number,
  deps: SchedulerDeps
): void {
  stopScheduler();

  // WHY: 立即執行一次，不等第一個 interval
  runScheduledCheck(deps).catch((err) => {
    console.error('[scheduler] Initial check failed:', err);
  });

  schedulerInterval = setInterval(() => {
    runScheduledCheck(deps).catch((err) => {
      console.error('[scheduler] Scheduled check failed:', err);
    });
  }, intervalMs);

  const intervalSec = Math.floor(intervalMs / 1000);
  console.log(`[scheduler] Started — checking every ${intervalSec}s for stuck tasks`);
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[scheduler] Stopped');
  }
}
