// src/application/use-cases/handle-hook-event.ts

import type { HookEvent } from "../../domain/hook-event.js";
import { createArtifact } from "../../domain/context-ledger.js";
import { createDaemonEvent } from "../../domain/daemon-event.js";
import { calculateRecycleThreshold, createDefaultRegistry } from "../../domain/model-config.js";
import type { ContextLedgerPort } from "../ports/context-ledger-port.js";
import type { EventBusPort } from "../ports/event-bus-port.js";
import type { TaskRepositoryPort } from "../ports/mission-repository-port.js";


export interface HandleHookEventInput {
  readonly missionId: string;
  readonly event: HookEvent;
}

// WHY: sessionId -> { missionId, taskId, model } 的映射，
// 由外部維護（controller 層注入），讓 use case 能找到對應的 mission/task
export interface SessionRegistry {
  findBySessionId(sessionId: string): SessionRegistryEntry | null;
}

export interface SessionRegistryEntry {
  readonly missionId: string;
  readonly taskId: string;
  readonly model: string;
  readonly processId: number;
}

interface HandleHookEventDeps {
  readonly ledgerPort: ContextLedgerPort;
  readonly taskRepo: TaskRepositoryPort;
  readonly sessionRegistry: SessionRegistry;
  readonly eventBus: EventBusPort;
  readonly onRecycleNeeded: (sessionId: string, reason: string) => Promise<void>;
  readonly onTaskCompleted: (missionId: string, taskId: string) => Promise<void>;
}

export class HandleHookEventUseCase {
  constructor(private readonly deps: HandleHookEventDeps) {}

  async execute(input: HandleHookEventInput): Promise<void> {
    const { event } = input;

    switch (event.type) {
      case "PostToolUse":
        await this.handlePostToolUse(input.missionId, event.payload);
        break;
      case "PreCompact":
        await this.handlePreCompact(event.payload.sessionId);
        break;
      case "Stop":
        await this.handleStop(input.missionId, event.payload);
        break;
      case "SessionStart":
        await this.handleSessionStart(input.missionId, event.payload);
        break;
    }

    this.emitHookReceived(event);
  }

  private emitHookReceived(event: HookEvent): void {
    const sessionId = event.payload.sessionId;
    const summaryMap: Record<string, string> = {
      PostToolUse: `Tool: ${(event.payload as { tool?: string }).tool ?? "unknown"}`,
      PreCompact: "Context window compaction triggered",
      Stop: `Reason: ${(event.payload as { stopReason?: string }).stopReason ?? "unknown"}`,
      SessionStart: `Model: ${(event.payload as { model?: string }).model ?? "unknown"}`,
    };

    this.deps.eventBus.emit(
      createDaemonEvent("hook:received", {
        hookType: event.type,
        sessionId,
        summary: summaryMap[event.type] ?? event.type,
      })
    );
  }

  private async handlePostToolUse(
    missionId: string,
    payload: {
      sessionId: string;
      tool: string;
      input: Record<string, unknown>;
      output: string;
      outputTokenEstimate: number;
    }
  ): Promise<void> {
    const ledger = await this.deps.ledgerPort.load(missionId);
    const sessionCtx = ledger.sessions.find(
      (s) => s.sessionId === payload.sessionId
    );

    if (!sessionCtx) return;

    const updatedCtx = { ...sessionCtx };
    updatedCtx.tokenEstimate += payload.outputTokenEstimate;

    const filesRead = [...sessionCtx.filesRead];
    const filesWritten = [...sessionCtx.filesWritten];
    const toolInput = payload.input as Record<string, string>;

    if (payload.tool === "Read" && toolInput.file_path) {
      if (!filesRead.includes(toolInput.file_path)) {
        filesRead.push(toolInput.file_path);
      }
    }

    if (
      (payload.tool === "Write" || payload.tool === "Edit") &&
      toolInput.file_path
    ) {
      if (!filesWritten.includes(toolInput.file_path)) {
        filesWritten.push(toolInput.file_path);
      }
    }

    await this.deps.ledgerPort.upsertSessionContext(missionId, {
      ...updatedCtx,
      filesRead,
      filesWritten,
    });

    const entry = this.deps.sessionRegistry.findBySessionId(
      payload.sessionId
    );
    if (!entry) return;

    const registry = createDefaultRegistry();
    const threshold = calculateRecycleThreshold(registry, entry.model) ?? 0;

    if (threshold > 0) {
      this.deps.eventBus.emit(
        createDaemonEvent("session:token-updated", {
          missionId,
          sessionId: payload.sessionId,
          tokenEstimate: updatedCtx.tokenEstimate,
          recycleThreshold: threshold,
          utilization: threshold > 0 ? updatedCtx.tokenEstimate / threshold : 0,
        })
      );
    }

    if (threshold > 0 && updatedCtx.tokenEstimate >= threshold) {
      await this.deps.onRecycleNeeded(
        payload.sessionId,
        "token_threshold"
      );
    }
  }

  private async handlePreCompact(sessionId: string): Promise<void> {
    // WHY: PreCompact 是最後防線，觸發即表示 token 估算失準
    await this.deps.onRecycleNeeded(sessionId, "pre_compact");
  }

  private async handleStop(
    missionId: string,
    payload: {
      sessionId: string;
      stopReason: string;
      lastAssistantMessage: string;
    }
  ): Promise<void> {
    const entry = this.deps.sessionRegistry.findBySessionId(
      payload.sessionId
    );
    if (!entry) return;

    const artifact = createArtifact({
      sessionId: payload.sessionId,
      taskId: entry.taskId,
      type: "summary",
      content: payload.lastAssistantMessage,
    });
    await this.deps.ledgerPort.addArtifact(missionId, artifact);

    await this.deps.ledgerPort.upsertSessionContext(missionId, {
      sessionId: payload.sessionId,
      taskId: entry.taskId,
      tokenEstimate: 0,
      filesRead: [],
      filesWritten: [],
      status: "completed",
    });

    this.deps.eventBus.emit(
      createDaemonEvent("session:completed", {
        sessionId: payload.sessionId,
        taskId: entry.taskId,
      })
    );

    const isComplete = payload.lastAssistantMessage.includes("TASK_COMPLETE");

    if (isComplete) {
      const task = await this.deps.taskRepo.findById(
        missionId,
        entry.taskId
      );
      if (task && task.status === "running") {
        task.status = "completed";
        await this.deps.taskRepo.update(missionId, task);

        this.deps.eventBus.emit(
          createDaemonEvent("task:completed", {
            missionId,
            taskId: entry.taskId,
            title: task.title,
          })
        );

        await this.deps.onTaskCompleted(missionId, entry.taskId);
      }
    }
  }

  private async handleSessionStart(
    missionId: string,
    payload: { sessionId: string; model: string }
  ): Promise<void> {
    const entry = this.deps.sessionRegistry.findBySessionId(
      payload.sessionId
    );
    if (!entry) return;

    await this.deps.ledgerPort.upsertSessionContext(missionId, {
      sessionId: payload.sessionId,
      taskId: entry.taskId,
      tokenEstimate: 0,
      filesRead: [],
      filesWritten: [],
      status: "running",
    });
  }
}
