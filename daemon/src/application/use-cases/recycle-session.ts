// src/application/use-cases/recycle-session.ts

import { createArtifact } from "../../domain/context-ledger.js";
import { createDaemonEvent } from "../../domain/daemon-event.js";
import { canTransitionTo } from "../../domain/task.js";
import type { ContextLedgerPort } from "../ports/context-ledger-port.js";
import type { EventBusPort } from "../ports/event-bus-port.js";
import type { SessionManagerPort } from "../ports/session-manager-port.js";
import type { TaskRepositoryPort } from "../ports/mission-repository-port.js";
import { ApplicationError } from "../errors.js";
import { AssignTaskUseCase } from "./assign-task.js";

export interface RecycleSessionInput {
  readonly missionId: string;
  readonly sessionId: string;
  readonly reason: "token_threshold" | "pre_compact" | "heartbeat_timeout";
}

export interface RecycleSessionOutput {
  readonly oldSessionId: string;
  readonly newSessionId: string;
  readonly newProcessId: number;
  readonly artifactsSaved: number;
}

// WHY: sessionId -> processId/taskId 映射由外部提供，避免 use case 管理全局狀態
export interface RecycleSessionRegistry {
  findBySessionId(sessionId: string): {
    processId: number;
    taskId: string;
    missionId: string;
  } | null;
}

interface RecycleSessionDeps {
  readonly sessionManager: SessionManagerPort;
  readonly ledgerPort: ContextLedgerPort;
  readonly taskRepo: TaskRepositoryPort;
  readonly assignTask: AssignTaskUseCase;
  readonly sessionRegistry: RecycleSessionRegistry;
  readonly eventBus: EventBusPort;
}

export class RecycleSessionUseCase {
  constructor(private readonly deps: RecycleSessionDeps) {}

  async execute(
    input: RecycleSessionInput
  ): Promise<RecycleSessionOutput> {
    const entry = this.deps.sessionRegistry.findBySessionId(
      input.sessionId
    );
    if (!entry) {
      throw new ApplicationError(
        "SESSION_NOT_FOUND",
        `Session '${input.sessionId}' not found in registry`
      );
    }

    const ledger = await this.deps.ledgerPort.load(input.missionId);
    const sessionCtx = ledger.sessions.find(
      (s) => s.sessionId === input.sessionId
    );

    // CONTEXT: 建立 progress artifact 記錄回收時的狀態
    const progressArtifact = createArtifact({
      sessionId: input.sessionId,
      taskId: entry.taskId,
      type: "progress",
      content: buildProgressSummary(input, sessionCtx),
    });

    await this.deps.ledgerPort.addArtifact(
      input.missionId,
      progressArtifact
    );

    await this.deps.sessionManager.kill(entry.processId);

    await this.deps.ledgerPort.upsertSessionContext(input.missionId, {
      sessionId: input.sessionId,
      taskId: entry.taskId,
      tokenEstimate: sessionCtx?.tokenEstimate ?? 0,
      filesRead: sessionCtx?.filesRead ?? [],
      filesWritten: sessionCtx?.filesWritten ?? [],
      status: "recycled",
    });

    // WHY: 將 task 狀態重置為 retrying，讓 AssignTaskUseCase 可重新分配
    const task = await this.deps.taskRepo.findById(
      input.missionId,
      entry.taskId
    );
    if (task && task.status === "running") {
      if (canTransitionTo(task.status, "failed")) {
        task.status = "failed";
      }
      if (canTransitionTo(task.status, "retrying")) {
        task.status = "retrying";
      }
      await this.deps.taskRepo.update(input.missionId, task);
    }

    const assignResult = await this.deps.assignTask.execute({
      missionId: input.missionId,
      taskId: entry.taskId,
    });

    this.deps.eventBus.emit(
      createDaemonEvent("session:recycled", {
        missionId: input.missionId,
        oldSessionId: input.sessionId,
        newSessionId: assignResult.sessionId,
        reason: input.reason,
        tokenEstimate: sessionCtx?.tokenEstimate ?? 0,
      })
    );

    return {
      oldSessionId: input.sessionId,
      newSessionId: assignResult.sessionId,
      newProcessId: assignResult.processId,
      artifactsSaved: 1,
    };
  }
}

function buildProgressSummary(
  input: RecycleSessionInput,
  sessionCtx?: {
    tokenEstimate: number;
    filesRead: string[];
    filesWritten: string[];
  } | null
): string {
  const parts = [
    `Session recycled: ${input.reason}`,
    `Token estimate: ${sessionCtx?.tokenEstimate ?? 0}`,
  ];

  if (sessionCtx?.filesWritten.length) {
    parts.push(`Files written: ${sessionCtx.filesWritten.join(", ")}`);
  }
  if (sessionCtx?.filesRead.length) {
    parts.push(`Files read: ${sessionCtx.filesRead.join(", ")}`);
  }

  return parts.join("\n");
}
