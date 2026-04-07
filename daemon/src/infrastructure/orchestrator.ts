// src/infrastructure/orchestrator.ts
// WHY: Task assignment orchestration — 從 main.ts 提取以遵守 300 行限制

import { InMemorySessionRegistry } from './session-registry.js';
import { createTaskGraph, getReadyTasks, getMaxParallelWidth } from '../domain/task-graph.js';
import type { AssignTaskUseCase } from '../application/use-cases/assign-task.js';
import type { FileTaskRepository } from '../adapters/file-task-store.js';

// WHY: 模組層級 registry 供 assignReadyTasks 閉包使用
export const sessionRegistry = new InMemorySessionRegistry();

export interface OrchestratorDeps {
  assignTask: AssignTaskUseCase;
  taskRepo: FileTaskRepository;
}

// WHY: 每個 mission 的並行 sessions 數量由 DAG 最大平行寬度決定，不用全域限制
// 訂閱制使用者開 session 不用錢，沒理由限制
export async function assignReadyTasks(
  missionId: string,
  deps: OrchestratorDeps
): Promise<void> {
  const tasks = await deps.taskRepo.findByMissionId(missionId);
  const taskGraph = createTaskGraph(
    tasks.map((t) => ({
      id: t.id,
      status: t.status,
      dependencies: t.dependencies,
    }))
  );

  const readyTaskIds = getReadyTasks(taskGraph);
  if (readyTaskIds.length === 0) return;

  // WHY: 直接指派所有 ready tasks — DAG 本身就是最佳的並行控制
  const dagWidth = getMaxParallelWidth(taskGraph);
  const activeForMission = sessionRegistry.getActiveCountForMission(missionId);
  const toAssign = readyTaskIds.slice(0, Math.max(1, dagWidth - activeForMission));

  console.log(
    `[orchestrator] Assigning ${toAssign.length} tasks concurrently ` +
    `(DAG width: ${dagWidth}, active for mission: ${activeForMission})`
  );

  // WHY: Promise.allSettled 確保單一 task 失敗不會阻塞其他 task 的指派
  const results = await Promise.allSettled(
    toAssign.map((taskId) => assignAndRegister(missionId, taskId, deps))
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[orchestrator] Failed to assign task:', result.reason);
    }
  }
}

async function assignAndRegister(
  missionId: string,
  taskId: string,
  deps: OrchestratorDeps
): Promise<void> {
  const output = await deps.assignTask.execute({ missionId, taskId });

  sessionRegistry.register({
    sessionId: output.sessionId,
    missionId,
    taskId,
    model: output.model,
    processId: output.processId,
    status: 'running',
    lastHeartbeatAt: new Date().toISOString(),
  });

  const worktreeInfo = output.worktreePath ? `, worktree: ${output.worktreePath}` : '';
  console.log(
    `[orchestrator] Task ${taskId} assigned to session ${output.sessionId} ` +
    `(role: ${output.role}, pid: ${output.processId}, model: ${output.model}${worktreeInfo})`
  );
}
