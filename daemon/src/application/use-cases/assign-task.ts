// src/application/use-cases/assign-task.ts

import { createSession } from "../../domain/session.js";
import { canTransitionTo, type AgentRole, type Task } from "../../domain/task.js";
import type { Artifact, Decision } from "../../domain/context-ledger.js";
import { createDaemonEvent } from "../../domain/daemon-event.js";
import { estimateTokens } from "../../domain/model-config.js";
import {
  loadAgentDefinition,
  getRoleInstructions,
  type AgentDefinition,
} from "../../domain/agent-role.js";
import type { MissionRepositoryPort, TaskRepositoryPort } from "../ports/mission-repository-port.js";
import type { SessionManagerPort } from "../ports/session-manager-port.js";
import type { ContextLedgerPort } from "../ports/context-ledger-port.js";
import type { EventBusPort } from "../ports/event-bus-port.js";
import { ApplicationError } from "../errors.js";

export interface AssignTaskInput {
  readonly missionId: string;
  readonly taskId: string;
}

export interface AssignTaskOutput {
  readonly sessionId: string;
  readonly model: string;
  readonly prompt: string;
  readonly processId: number;
  readonly role: AgentRole;
  readonly worktreePath?: string;
}
interface CuratedPromptParts {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly taskDescription: string;
  readonly role: AgentRole;
  readonly roleInstructions: string;
  readonly acceptanceCriteria: string[];
  readonly previousArtifacts: Artifact[];
  readonly relevantDecisions: Decision[];
  readonly filesWrittenByOtherTasks: string[];
}
interface AssignTaskDeps {
  readonly missionRepo: MissionRepositoryPort;
  readonly taskRepo: TaskRepositoryPort;
  readonly sessionManager: SessionManagerPort;
  readonly ledgerPort: ContextLedgerPort;
  readonly eventBus: EventBusPort;
  readonly projectRoot?: string;
}
const MAX_PROMPT_CHARS = 40_000;
const DEFAULT_MODEL = "claude-sonnet-4-6";

export class AssignTaskUseCase {
  constructor(private readonly deps: AssignTaskDeps) {}

  async execute(input: AssignTaskInput): Promise<AssignTaskOutput> {
    const mission = await this.deps.missionRepo.findById(input.missionId);
    if (!mission) {
      throw new ApplicationError(
        "MISSION_NOT_FOUND",
        `Mission '${input.missionId}' not found`
      );
    }

    const task = await this.deps.taskRepo.findById(
      input.missionId,
      input.taskId
    );
    if (!task) {
      throw new ApplicationError(
        "TASK_NOT_FOUND",
        `Task '${input.taskId}' not found in mission '${input.missionId}'`
      );
    }

    if (task.status !== "pending" && task.status !== "retrying") {
      throw new ApplicationError(
        "TASK_NOT_ASSIGNABLE",
        `Task '${input.taskId}' is in status '${task.status}', expected 'pending' or 'retrying'`
      );
    }

    // WHY: 載入 agent 定義檔以注入角色上下文，失敗時降級為無角色上下文
    const projectRoot = this.deps.projectRoot ?? process.cwd();
    const agentDef = await loadAgentDefinition(projectRoot, task.role);

    const model = resolveModel(task, mission.config.defaultModel, agentDef);
    const prompt = await this.buildCuratedPrompt(input.missionId, task);

    const promptTokens = estimateTokens(prompt);
    if (promptTokens > 10_000) {
      throw new ApplicationError(
        "PROMPT_TOO_LARGE",
        `Curated prompt is ${promptTokens} tokens, exceeds 10K limit`
      );
    }

    // WHY: implementer 角色使用 worktree 隔離，避免平行 agent 互相衝突
    const useWorktree = task.role === "implementer";

    const spawnResult = await this.deps.sessionManager.spawn({
      model,
      prompt,
      workingDirectory: projectRoot,
      maxBudgetUsd: mission.config.costLimitUsd,
      env: {},
      role: task.role,
      agentDefinition: agentDef ?? undefined,
      useWorktree,
    });

    const session = createSession({
      taskId: task.id,
      missionId: input.missionId,
      model,
    });
    session.processId = spawnResult.processId;
    session.status = "running";

    if (!canTransitionTo(task.status, "assigned")) {
      throw new ApplicationError("INVALID_TRANSITION", `Cannot transition task from '${task.status}' to 'assigned'`);
    }
    task.status = "assigned";
    task.assignedSessionId = session.id;
    if (!canTransitionTo(task.status, "running")) {
      throw new ApplicationError("INVALID_TRANSITION", `Cannot transition task from '${task.status}' to 'running'`);
    }
    task.status = "running";

    await this.deps.taskRepo.update(input.missionId, task);
    await this.deps.ledgerPort.upsertSessionContext(input.missionId, {
      sessionId: session.id,
      taskId: task.id,
      tokenEstimate: 0,
      filesRead: [],
      filesWritten: [],
      status: "running",
    });

    this.deps.eventBus.emit(
      createDaemonEvent("session:spawned", {
        missionId: input.missionId,
        sessionId: session.id,
        taskId: task.id,
        model,
        processId: spawnResult.processId,
      })
    );

    this.deps.eventBus.emit(
      createDaemonEvent("task:assigned", {
        missionId: input.missionId,
        taskId: task.id,
        sessionId: session.id,
        model,
      })
    );

    return {
      sessionId: session.id,
      model,
      prompt,
      processId: spawnResult.processId,
      role: task.role,
      worktreePath: spawnResult.worktreePath,
    };
  }

  private async buildCuratedPrompt(
    missionId: string,
    task: Task
  ): Promise<string> {
    const [artifacts, decisions, ledger] = await Promise.all([
      this.deps.ledgerPort.getArtifactsForTask(missionId, task.id),
      this.deps.ledgerPort.getDecisionsForTask(missionId, task.id),
      this.deps.ledgerPort.load(missionId),
    ]);

    const filesWrittenByOthers = collectFilesWrittenByOtherTasks(
      ledger.sessions,
      task.id
    );

    const parts: CuratedPromptParts = {
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
      role: task.role,
      roleInstructions: getRoleInstructions(task.role),
      acceptanceCriteria: task.acceptanceCriteria.map((c) => c.description),
      previousArtifacts: trimArtifactsToFit(artifacts),
      relevantDecisions: decisions,
      filesWrittenByOtherTasks: filesWrittenByOthers,
    };

    return renderCuratedPrompt(parts);
  }
}

// WHY: Model 優先順序：task 明確指定 > agent 定義檔 > mission 預設 > 全域預設
function resolveModel(
  task: Task,
  missionDefault: string | undefined,
  agentDef: AgentDefinition | null
): string {
  if (task.model) return task.model;
  if (agentDef?.model && agentDef.model !== "inherit") return agentDef.model;
  return missionDefault ?? DEFAULT_MODEL;
}

function collectFilesWrittenByOtherTasks(
  sessions: Array<{ taskId: string; filesWritten: string[] }>,
  currentTaskId: string
): string[] {
  const files = new Set<string>();
  for (const session of sessions) {
    if (session.taskId !== currentTaskId) {
      for (const f of session.filesWritten) {
        files.add(f);
      }
    }
  }
  return [...files];
}

// AI-INVARIANT: 最終 prompt 必須 < 10,000 tokens（約 40,000 字元）
function trimArtifactsToFit(artifacts: Artifact[]): Artifact[] {
  const sorted = [...artifacts].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  );

  const result: Artifact[] = [];
  let totalChars = 0;

  for (const artifact of sorted) {
    const newTotal = totalChars + artifact.content.length;
    if (newTotal > MAX_PROMPT_CHARS * 0.4) break;
    result.push(artifact);
    totalChars = newTotal;
  }

  return result.reverse();
}

function renderCuratedPrompt(parts: CuratedPromptParts): string {
  const sections: string[] = [];

  // WHY: 角色指示放在最前面，確保 agent 從一開始就知道自己的職責
  sections.push(
    `## 角色: ${parts.role}`,
    parts.roleInstructions,
  );

  sections.push(
    `\n## 任務: ${parts.taskId} - ${parts.taskTitle}`,
    parts.taskDescription
  );

  if (parts.acceptanceCriteria.length > 0) {
    sections.push(
      `\n## 驗收標準`,
      ...parts.acceptanceCriteria.map((c) => `- ${c}`)
    );
  }

  if (parts.previousArtifacts.length > 0) {
    sections.push(
      `\n## 前次進度`,
      ...parts.previousArtifacts.map(
        (a) => `### [${a.type}] ${a.createdAt}\n${a.content}`
      )
    );
  }

  if (parts.relevantDecisions.length > 0) {
    sections.push(
      `\n## 已做的關鍵決策`,
      ...parts.relevantDecisions.map(
        (d) => `- ${d.summary}: ${d.rationale}`
      )
    );
  }

  if (parts.filesWrittenByOtherTasks.length > 0) {
    sections.push(
      `\n## 其他 session 已修改的檔案`,
      ...parts.filesWrittenByOtherTasks.map((f) => `- ${f}`)
    );
  }

  sections.push(
    `\n## 指示`,
    `1. 讀取 CLAUDE.md 了解專案規範`,
    `2. 從前次進度繼續，不要重做已完成的工作`,
    `3. 完成後在最後一行輸出 "TASK_COMPLETE" 標記`
  );

  return sections.join("\n");
}
