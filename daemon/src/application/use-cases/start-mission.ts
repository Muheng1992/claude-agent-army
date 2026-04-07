// src/application/use-cases/start-mission.ts

import { createMission, type MissionConfig } from "../../domain/mission.js";
import { createTask, type AgentRole, type Task } from "../../domain/task.js";
import { createLedger } from "../../domain/context-ledger.js";
import { createDaemonEvent } from "../../domain/daemon-event.js";
import { createTaskGraph } from "../../domain/task-graph.js";
import type { MissionRepositoryPort, TaskRepositoryPort } from "../ports/mission-repository-port.js";
import type { ContextLedgerPort } from "../ports/context-ledger-port.js";
import type { EventBusPort } from "../ports/event-bus-port.js";
import { ApplicationError } from "../errors.js";

export interface StartMissionInput {
  readonly description: string;
  readonly model?: string;
  readonly maxConcurrentSessions?: number;
  readonly maxRetries?: number;
  readonly costLimitUsd?: number;
  readonly durationLimitMinutes?: number;
}

export interface StartMissionOutput {
  readonly missionId: string;
  readonly name: string;
  readonly taskCount: number;
  readonly tasks: Array<{
    readonly id: string;
    readonly title: string;
    readonly dependencies: string[];
  }>;
}

interface StartMissionDeps {
  readonly missionRepo: MissionRepositoryPort;
  readonly taskRepo: TaskRepositoryPort;
  readonly ledgerPort: ContextLedgerPort;
  readonly eventBus: EventBusPort;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";

export class StartMissionUseCase {
  constructor(private readonly deps: StartMissionDeps) {}

  async execute(input: StartMissionInput): Promise<StartMissionOutput> {
    const tasks = parseDescriptionIntoTasks(input.description);

    if (tasks.length === 0) {
      throw new ApplicationError(
        "NO_TASKS_PARSED",
        "Could not parse any tasks from the mission description"
      );
    }

    const config: MissionConfig = {
      description: input.description,
      defaultModel: input.model ?? DEFAULT_MODEL,
      maxConcurrentSessions: input.maxConcurrentSessions ?? 10,
      maxRetries: input.maxRetries ?? 2,
      costLimitUsd: input.costLimitUsd ?? 10,
      durationLimitMinutes: input.durationLimitMinutes ?? 120,
    };

    const missionName = extractMissionName(input.description);
    const mission = createMission(missionName, config);

    // WHY: 驗證 DAG 合法性（無環），createTaskGraph 若偵測到環會 throw DomainError
    createTaskGraph(
      tasks.map((t) => ({
        id: t.id,
        status: t.status,
        dependencies: t.dependencies,
      }))
    );

    mission.status = "running";
    mission.updatedAt = new Date().toISOString();

    await this.deps.missionRepo.save(mission);
    await this.deps.taskRepo.saveAll(mission.id, tasks);
    await this.deps.ledgerPort.save(createLedger(mission.id));

    this.deps.eventBus.emit(
      createDaemonEvent("mission:started", {
        missionId: mission.id,
        name: mission.name,
        taskCount: tasks.length,
      })
    );

    return {
      missionId: mission.id,
      name: mission.name,
      taskCount: tasks.length,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        dependencies: t.dependencies,
      })),
    };
  }
}

// CONTEXT: MVP 使用簡易 markdown 解析，解析 BACKLOG.md 風格的 task 列表。
// 格式為: "- [ ] T01: Task title — description" 或 "## T01: Title\ndescription"
function parseDescriptionIntoTasks(description: string): Task[] {
  const tasks: Task[] = [];
  const lines = description.split("\n");
  let currentTask: { id: string; title: string; desc: string[] } | null = null;

  for (const line of lines) {
    const taskMatch = line.match(
      /^(?:-\s*\[[ x]?\]\s*|##\s*)(T\d{2,3})[\s:：]+(.+)/
    );

    if (taskMatch) {
      if (currentTask) {
        tasks.push(buildTask(currentTask, tasks.length));
      }
      currentTask = {
        id: taskMatch[1],
        title: taskMatch[2].trim(),
        desc: [],
      };
    } else if (currentTask && line.trim()) {
      currentTask.desc.push(line.trim());
    }
  }

  if (currentTask) {
    tasks.push(buildTask(currentTask, tasks.length));
  }

  return tasks;
}

const VALID_ROLES: ReadonlySet<string> = new Set([
  "architect", "implementer", "tester", "documenter", "tech-lead",
]);

function buildTask(
  parsed: { id: string; title: string; desc: string[] },
  index: number
): Task {
  // WHY: 從描述中解析 "depends: T01, T02" 和 "role: architect" 格式的欄位
  const deps: string[] = [];
  const descLines: string[] = [];
  let role: AgentRole = "implementer";

  for (const line of parsed.desc) {
    const depMatch = line.match(/^depends?:\s*(.+)/i);
    if (depMatch) {
      deps.push(
        ...depMatch[1].split(/[,，]\s*/).map((d) => d.trim())
      );
      continue;
    }

    const roleMatch = line.match(/^role:\s*(.+)/i);
    if (roleMatch) {
      const parsed = roleMatch[1].trim().toLowerCase();
      if (VALID_ROLES.has(parsed)) {
        role = parsed as AgentRole;
      }
      continue;
    }

    descLines.push(line);
  }

  return createTask({
    id: parsed.id,
    missionId: "",
    title: parsed.title,
    description: descLines.join("\n"),
    dependencies: deps,
    priority: index + 1,
    role,
  });
}

function extractMissionName(description: string): string {
  const firstLine = description.split("\n")[0].trim();
  const headerMatch = firstLine.match(/^#\s+(.+)/);
  if (headerMatch) return headerMatch[1].substring(0, 80);
  return firstLine.substring(0, 80) || "Unnamed Mission";
}
