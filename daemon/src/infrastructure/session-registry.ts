// src/infrastructure/session-registry.ts
// WHY: 統一的 session 登記表，實作 handle-hook-event、recycle-session、check-health 所需的介面
// CONTEXT: 全局 mutable 狀態屬於 infrastructure 層管理，use case 透過介面存取

import type { SessionStatus } from "../domain/session.js";
import type { SessionRegistry, SessionRegistryEntry } from "../application/use-cases/handle-hook-event.js";
import type { RecycleSessionRegistry } from "../application/use-cases/recycle-session.js";
import type { HealthSessionRegistry } from "../application/use-cases/check-health.js";

export interface FullSessionRegistryEntry {
  readonly sessionId: string;
  readonly missionId: string;
  readonly taskId: string;
  readonly model: string;
  readonly processId: number;
  readonly status: SessionStatus;
  readonly lastHeartbeatAt: string;
}

export class InMemorySessionRegistry
  implements SessionRegistry, RecycleSessionRegistry, HealthSessionRegistry
{
  private readonly bySessionId = new Map<string, FullSessionRegistryEntry>();
  private readonly byProcessId = new Map<number, string>();

  register(entry: FullSessionRegistryEntry): void {
    this.bySessionId.set(entry.sessionId, entry);
    this.byProcessId.set(entry.processId, entry.sessionId);
  }

  unregister(sessionId: string): void {
    const entry = this.bySessionId.get(sessionId);
    if (entry) {
      this.byProcessId.delete(entry.processId);
      this.bySessionId.delete(sessionId);
    }
  }

  updateStatus(sessionId: string, status: SessionStatus): void {
    const entry = this.bySessionId.get(sessionId);
    if (entry) {
      this.bySessionId.set(sessionId, { ...entry, status });
    }
  }

  updateHeartbeat(sessionId: string): void {
    const entry = this.bySessionId.get(sessionId);
    if (entry) {
      this.bySessionId.set(sessionId, {
        ...entry,
        lastHeartbeatAt: new Date().toISOString(),
      });
    }
  }

  // SessionRegistry (handle-hook-event)
  findBySessionId(sessionId: string): SessionRegistryEntry | null {
    const entry = this.bySessionId.get(sessionId);
    if (!entry) return null;
    return {
      missionId: entry.missionId,
      taskId: entry.taskId,
      model: entry.model,
      processId: entry.processId,
    };
  }

  findByProcessId(processId: number): FullSessionRegistryEntry | null {
    const sessionId = this.byProcessId.get(processId);
    if (!sessionId) return null;
    return this.bySessionId.get(sessionId) ?? null;
  }

  // HealthSessionRegistry (check-health)
  getActiveSessions(missionId: string): Array<{
    sessionId: string;
    taskId: string;
    processId: number;
    model: string;
    lastHeartbeatAt: string;
    status: SessionStatus;
  }> {
    const result: Array<{
      sessionId: string;
      taskId: string;
      processId: number;
      model: string;
      lastHeartbeatAt: string;
      status: SessionStatus;
    }> = [];

    for (const entry of this.bySessionId.values()) {
      if (entry.missionId !== missionId) continue;
      if (entry.status !== "running" && entry.status !== "spawning") continue;

      result.push({
        sessionId: entry.sessionId,
        taskId: entry.taskId,
        processId: entry.processId,
        model: entry.model,
        lastHeartbeatAt: entry.lastHeartbeatAt,
        status: entry.status,
      });
    }

    return result;
  }

  /** 取得特定 mission 的活躍 session 數量（用於 parallel orchestration） */
  getActiveCountForMission(missionId: string): number {
    let count = 0;
    for (const entry of this.bySessionId.values()) {
      if (entry.missionId !== missionId) continue;
      if (entry.status === "running" || entry.status === "spawning") {
        count++;
      }
    }
    return count;
  }

  /** 依 taskId 查找 session（用於 orchestrator 完成回呼） */
  findByTaskId(taskId: string): FullSessionRegistryEntry | undefined {
    for (const entry of this.bySessionId.values()) {
      if (entry.taskId === taskId) {
        return entry;
      }
    }
    return undefined;
  }

  /** 取得所有登記的 session 數量（用於 /health 端點） */
  getActiveCount(): number {
    let count = 0;
    for (const entry of this.bySessionId.values()) {
      if (entry.status === "running" || entry.status === "spawning") {
        count++;
      }
    }
    return count;
  }

  /** 取得所有 session（用於 /api/state 端點） */
  getAllEntries(): FullSessionRegistryEntry[] {
    return [...this.bySessionId.values()];
  }
}
