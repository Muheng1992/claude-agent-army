// src/application/use-cases/check-health.ts

import type { SessionStatus } from "../../domain/session.js";
import type { MissionStatus } from "../../domain/mission.js";
import { createDaemonEvent } from "../../domain/daemon-event.js";
import { calculateRecycleThreshold, createDefaultRegistry } from "../../domain/model-config.js";
import type { ContextLedgerPort } from "../ports/context-ledger-port.js";
import type { EventBusPort } from "../ports/event-bus-port.js";
import type { SessionManagerPort } from "../ports/session-manager-port.js";
import type { MissionRepositoryPort, TaskRepositoryPort } from "../ports/mission-repository-port.js";
import { ApplicationError } from "../errors.js";

export interface CheckHealthInput {
  readonly missionId: string;
}

export interface SessionHealth {
  readonly sessionId: string;
  readonly taskId: string;
  readonly processAlive: boolean;
  readonly tokenEstimate: number;
  readonly recycleThreshold: number;
  readonly tokenUtilization: number;
  readonly lastHeartbeatAge: number;
  readonly status: SessionStatus;
}

export interface CheckHealthOutput {
  readonly missionId: string;
  readonly missionStatus: MissionStatus;
  readonly activeSessions: SessionHealth[];
  readonly completedTasks: number;
  readonly totalTasks: number;
  readonly totalTokensConsumed: number;
  readonly warnings: string[];
}

// WHY: sessionId -> { processId, model, lastHeartbeatAt } 的映射由外部提供
export interface HealthSessionRegistry {
  getActiveSessions(missionId: string): Array<{
    sessionId: string;
    taskId: string;
    processId: number;
    model: string;
    lastHeartbeatAt: string;
    status: SessionStatus;
  }>;
}

interface CheckHealthDeps {
  readonly missionRepo: MissionRepositoryPort;
  readonly taskRepo: TaskRepositoryPort;
  readonly ledgerPort: ContextLedgerPort;
  readonly sessionManager: SessionManagerPort;
  readonly sessionRegistry: HealthSessionRegistry;
  readonly eventBus: EventBusPort;
}

const HEARTBEAT_TIMEOUT_SECONDS = 120;

export class CheckHealthUseCase {
  constructor(private readonly deps: CheckHealthDeps) {}

  async execute(input: CheckHealthInput): Promise<CheckHealthOutput> {
    const mission = await this.deps.missionRepo.findById(input.missionId);
    if (!mission) {
      throw new ApplicationError(
        "MISSION_NOT_FOUND",
        `Mission '${input.missionId}' not found`
      );
    }

    const tasks = await this.deps.taskRepo.findByMissionId(
      input.missionId
    );
    const ledger = await this.deps.ledgerPort.load(input.missionId);
    const activeSessions = this.deps.sessionRegistry.getActiveSessions(
      input.missionId
    );

    const registry = createDefaultRegistry();
    const warnings: string[] = [];
    const sessionHealths: SessionHealth[] = [];
    let totalTokens = 0;

    for (const session of activeSessions) {
      const processAlive = await this.deps.sessionManager.isAlive(
        session.processId
      );

      const sessionCtx = ledger.sessions.find(
        (s) => s.sessionId === session.sessionId
      );
      const tokenEstimate = sessionCtx?.tokenEstimate ?? 0;
      totalTokens += tokenEstimate;

      const threshold = calculateRecycleThreshold(
        registry,
        session.model
      ) ?? 0;
      const utilization = threshold > 0 ? tokenEstimate / threshold : 0;

      const lastHeartbeat = new Date(session.lastHeartbeatAt).getTime();
      const heartbeatAge = Math.floor(
        (Date.now() - lastHeartbeat) / 1000
      );

      if (!processAlive && session.status === "running") {
        warnings.push(
          `Session ${session.sessionId} process is dead but status is 'running'`
        );
      }

      if (heartbeatAge > HEARTBEAT_TIMEOUT_SECONDS) {
        warnings.push(
          `Session ${session.sessionId} heartbeat timeout (${heartbeatAge}s)`
        );
      }

      if (utilization > 0.8) {
        warnings.push(
          `Session ${session.sessionId} token utilization at ${(utilization * 100).toFixed(0)}%`
        );
      }

      sessionHealths.push({
        sessionId: session.sessionId,
        taskId: session.taskId,
        processAlive,
        tokenEstimate,
        recycleThreshold: threshold,
        tokenUtilization: utilization,
        lastHeartbeatAge: heartbeatAge,
        status: session.status,
      });
    }

    const completedTasks = tasks.filter(
      (t) => t.status === "completed"
    ).length;

    for (const warning of warnings) {
      this.deps.eventBus.emit(
        createDaemonEvent("health:warning", {
          message: warning,
          sessionId: undefined,
        })
      );
    }

    return {
      missionId: input.missionId,
      missionStatus: mission.status,
      activeSessions: sessionHealths,
      completedTasks,
      totalTasks: tasks.length,
      totalTokensConsumed: totalTokens,
      warnings,
    };
  }
}
