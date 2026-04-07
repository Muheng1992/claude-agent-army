// src/application/ports/mission-repository-port.ts

import type { Mission, MissionStatus } from "../../domain/mission.js";
import type { Task } from "../../domain/task.js";

export interface MissionRepositoryPort {
  save(mission: Mission): Promise<void>;
  findById(missionId: string): Promise<Mission | null>;
  updateStatus(missionId: string, status: MissionStatus): Promise<void>;
}

export interface TaskRepositoryPort {
  saveAll(missionId: string, tasks: Task[]): Promise<void>;
  findByMissionId(missionId: string): Promise<Task[]>;
  findById(missionId: string, taskId: string): Promise<Task | null>;
  update(missionId: string, task: Task): Promise<void>;
}
