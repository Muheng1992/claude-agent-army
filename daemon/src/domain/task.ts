// Domain Layer — Task Entity with State Machine

import { invalidTransition } from "./errors.js";

export type AgentRole =
  | "architect"
  | "implementer"
  | "tester"
  | "documenter"
  | "tech-lead";

export type TaskStatus =
  | "pending"
  | "assigned"
  | "running"
  | "verifying"
  | "completed"
  | "failed"
  | "retrying"
  | "abandoned";

export interface TaskTransition {
  readonly from: TaskStatus;
  readonly to: TaskStatus;
}

// AI-INVARIANT: 合法的狀態轉移定義
// pending → assigned → running → verifying → completed
//                   ↘ failed → retrying → running
//                                       ↘ abandoned (max retries exceeded)
const VALID_TRANSITIONS: readonly TaskTransition[] = [
  { from: "pending",   to: "assigned"  },
  { from: "assigned",  to: "running"   },
  { from: "running",   to: "verifying" },
  { from: "running",   to: "failed"    },
  { from: "running",   to: "completed" },  // WHY: v0.1 跳過 verifying 直接完成
  { from: "verifying", to: "completed" },
  { from: "verifying", to: "failed"    },
  { from: "failed",    to: "retrying"  },
  { from: "failed",    to: "abandoned" },
  { from: "retrying",  to: "running"   },
];

export interface AcceptanceCriteria {
  readonly description: string;
  readonly checkCommand: string | null;
}

export interface Task {
  readonly id: string;
  readonly missionId: string;
  readonly title: string;
  readonly description: string;
  status: TaskStatus;
  readonly dependencies: string[];
  assignedSessionId: string | null;
  readonly acceptanceCriteria: AcceptanceCriteria[];
  retryCount: number;
  readonly maxRetries: number;
  readonly role: AgentRole;
  readonly model: string | null;
  readonly priority: number;
  lastError: string | null;
}

export function canTransitionTo(current: TaskStatus, next: TaskStatus): boolean {
  return VALID_TRANSITIONS.some(
    (t) => t.from === current && t.to === next
  );
}

export function transitionTo(task: Task, next: TaskStatus): Task {
  if (!canTransitionTo(task.status, next)) {
    throw invalidTransition(task.status, next);
  }
  const updates: Partial<Task> = { status: next };

  if (next === "retrying") {
    updates.retryCount = task.retryCount + 1;
  }
  if (next === "assigned" || next === "running") {
    updates.lastError = null;
  }

  return { ...task, ...updates };
}

export function assignSession(task: Task, sessionId: string): Task {
  return { ...task, assignedSessionId: sessionId };
}

export function setError(task: Task, error: string): Task {
  return { ...task, lastError: error };
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return status === "completed" || status === "abandoned";
}

export function createTask(params: {
  id: string;
  missionId: string;
  title: string;
  description: string;
  dependencies?: string[];
  acceptanceCriteria?: AcceptanceCriteria[];
  maxRetries?: number;
  model?: string | null;
  priority?: number;
  role?: AgentRole;
}): Task {
  return {
    id: params.id,
    missionId: params.missionId,
    title: params.title,
    description: params.description,
    status: "pending",
    dependencies: params.dependencies ?? [],
    assignedSessionId: null,
    acceptanceCriteria: params.acceptanceCriteria ?? [],
    retryCount: 0,
    maxRetries: params.maxRetries ?? 3,
    role: params.role ?? "implementer",
    model: params.model ?? null,
    priority: params.priority ?? 5,
    lastError: null,
  };
}
