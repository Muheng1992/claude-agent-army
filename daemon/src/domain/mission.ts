// Domain Layer — Mission Aggregate Root

export type MissionStatus =
  | "planning"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface MissionConfig {
  readonly description: string;
  readonly defaultModel: string;
  readonly maxConcurrentSessions: number;
  readonly maxRetries: number;
  readonly costLimitUsd: number;
  readonly durationLimitMinutes: number;
}

export interface Mission {
  readonly id: string;
  readonly name: string;
  status: MissionStatus;
  readonly config: MissionConfig;
  readonly taskIds: string[];
  readonly createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

function generateId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `mission-${timestamp}-${random}`;
}

export function createMission(name: string, config: MissionConfig): Mission {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name,
    status: "planning",
    config,
    taskIds: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

const VALID_MISSION_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  planning:  ["running", "cancelled"],
  running:   ["paused", "completed", "failed", "cancelled"],
  paused:    ["running", "cancelled"],
  completed: [],
  failed:    [],
  cancelled: [],
};

export function canMissionTransitionTo(
  current: MissionStatus,
  next: MissionStatus
): boolean {
  return VALID_MISSION_TRANSITIONS[current].includes(next);
}

export function transitionMission(mission: Mission, next: MissionStatus): Mission {
  if (!canMissionTransitionTo(mission.status, next)) {
    throw new Error(
      `Cannot transition mission from "${mission.status}" to "${next}"`
    );
  }
  const now = new Date().toISOString();
  const isTerminal = next === "completed" || next === "failed" || next === "cancelled";
  return {
    ...mission,
    status: next,
    updatedAt: now,
    completedAt: isTerminal ? now : mission.completedAt,
  };
}

export function addTaskToMission(mission: Mission, taskId: string): Mission {
  return {
    ...mission,
    taskIds: [...mission.taskIds, taskId],
    updatedAt: new Date().toISOString(),
  };
}
