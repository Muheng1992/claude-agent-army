// src/application/dtos/mission-dto.ts

import type { MissionStatus } from "../../domain/mission.js";
import type { TaskStatus } from "../../domain/task.js";
import type { SessionStatus } from "../../domain/session.js";

export interface MissionStatusDto {
  readonly missionId: string;
  readonly name: string;
  readonly status: MissionStatus;
  readonly progress: {
    readonly completedTasks: number;
    readonly totalTasks: number;
    readonly activeSessions: number;
    readonly totalTokensConsumed: number;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TaskStatusDto {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly dependencies: string[];
  readonly assignedSessionId: string | null;
  readonly retryCount: number;
  readonly lastError: string | null;
}

export interface SessionStatusDto {
  readonly id: string;
  readonly taskId: string;
  readonly model: string;
  readonly status: SessionStatus;
  readonly tokenEstimate: number;
  readonly processAlive: boolean;
  readonly tokenUtilization: number;
  readonly spawnedAt: string;
}
