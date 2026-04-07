// Domain Layer — Daemon Event Types
// WHY: Event types 定義在 domain 層 — 它們是業務概念的一部分

export type DaemonEventType =
  | "mission:started"
  | "mission:completed"
  | "mission:failed"
  | "mission:cancelled"
  | "task:assigned"
  | "task:started"
  | "task:completed"
  | "task:failed"
  | "task:retrying"
  | "task:abandoned"
  | "session:spawned"
  | "session:recycled"
  | "session:completed"
  | "session:killed"
  | "session:token-updated"
  | "hook:received"
  | "health:warning"
  | "artifact:created"
  | "decision:recorded";

interface BaseEvent {
  readonly id: string;
  readonly type: DaemonEventType;
  readonly timestamp: string;
}

export interface MissionStartedEvent extends BaseEvent {
  readonly type: "mission:started";
  readonly payload: {
    readonly missionId: string;
    readonly name: string;
    readonly taskCount: number;
  };
}

export interface MissionCompletedEvent extends BaseEvent {
  readonly type: "mission:completed";
  readonly payload: {
    readonly missionId: string;
    readonly completedTasks: number;
    readonly totalTasks: number;
  };
}

export interface MissionFailedEvent extends BaseEvent {
  readonly type: "mission:failed";
  readonly payload: {
    readonly missionId: string;
    readonly reason: string;
  };
}

export interface MissionCancelledEvent extends BaseEvent {
  readonly type: "mission:cancelled";
  readonly payload: {
    readonly missionId: string;
    readonly killedSessions: number;
  };
}

export interface TaskAssignedEvent extends BaseEvent {
  readonly type: "task:assigned";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly sessionId: string;
    readonly model: string;
  };
}

export interface TaskStartedEvent extends BaseEvent {
  readonly type: "task:started";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly title: string;
  };
}

export interface TaskCompletedEvent extends BaseEvent {
  readonly type: "task:completed";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly title: string;
  };
}

export interface TaskFailedEvent extends BaseEvent {
  readonly type: "task:failed";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly error: string;
  };
}

export interface TaskRetryingEvent extends BaseEvent {
  readonly type: "task:retrying";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly retryCount: number;
    readonly maxRetries: number;
  };
}

export interface TaskAbandonedEvent extends BaseEvent {
  readonly type: "task:abandoned";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly reason: string;
  };
}

export interface SessionSpawnedEvent extends BaseEvent {
  readonly type: "session:spawned";
  readonly payload: {
    readonly missionId: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly model: string;
    readonly processId: number;
  };
}

export interface SessionRecycledEvent extends BaseEvent {
  readonly type: "session:recycled";
  readonly payload: {
    readonly missionId: string;
    readonly oldSessionId: string;
    readonly newSessionId: string;
    readonly reason: string;
    readonly tokenEstimate: number;
  };
}

export interface SessionCompletedEvent extends BaseEvent {
  readonly type: "session:completed";
  readonly payload: {
    readonly sessionId: string;
    readonly taskId: string;
  };
}

export interface SessionKilledEvent extends BaseEvent {
  readonly type: "session:killed";
  readonly payload: {
    readonly sessionId: string;
    readonly processId: number;
  };
}

export interface SessionTokenUpdatedEvent extends BaseEvent {
  readonly type: "session:token-updated";
  readonly payload: {
    readonly missionId: string;
    readonly sessionId: string;
    readonly tokenEstimate: number;
    readonly recycleThreshold: number;
    readonly utilization: number;
  };
}

export interface HookReceivedEvent extends BaseEvent {
  readonly type: "hook:received";
  readonly payload: {
    readonly hookType: string;
    readonly sessionId: string;
    readonly summary: string;
  };
}

export interface HealthWarningEvent extends BaseEvent {
  readonly type: "health:warning";
  readonly payload: {
    readonly message: string;
    readonly sessionId?: string;
  };
}

export interface ArtifactCreatedEvent extends BaseEvent {
  readonly type: "artifact:created";
  readonly payload: {
    readonly missionId: string;
    readonly artifactId: string;
    readonly taskId: string;
    readonly artifactType: string;
    readonly contentPreview: string;
  };
}

export interface DecisionRecordedEvent extends BaseEvent {
  readonly type: "decision:recorded";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly sessionId: string;
    readonly summary: string;
    readonly rationale: string;
    readonly affectedFiles: string[];
  };
}

export type DaemonEvent =
  | MissionStartedEvent
  | MissionCompletedEvent
  | MissionFailedEvent
  | MissionCancelledEvent
  | TaskAssignedEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskRetryingEvent
  | TaskAbandonedEvent
  | SessionSpawnedEvent
  | SessionRecycledEvent
  | SessionCompletedEvent
  | SessionKilledEvent
  | SessionTokenUpdatedEvent
  | HookReceivedEvent
  | HealthWarningEvent
  | ArtifactCreatedEvent
  | DecisionRecordedEvent;

export function createEventId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `event-${timestamp}-${random}`;
}

export function createDaemonEvent<T extends DaemonEvent>(
  type: T["type"],
  payload: T["payload"]
): T {
  return {
    id: createEventId(),
    type,
    timestamp: new Date().toISOString(),
    payload,
  } as T;
}
