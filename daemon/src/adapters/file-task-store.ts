// src/adapters/file-task-store.ts
// WHY: 實作 MissionRepositoryPort 和 TaskRepositoryPort，使用 JSON 檔案持久化

import { join } from 'node:path';
import type { Mission, MissionStatus } from '../domain/mission.js';
import type { Task } from '../domain/task.js';
import type {
  MissionRepositoryPort,
  TaskRepositoryPort,
} from '../application/ports/mission-repository-port.js';
import type { PersistencePort } from '../application/ports/persistence-port.js';

export class FileMissionRepository implements MissionRepositoryPort {
  constructor(
    private readonly dataDir: string,
    private readonly persistence: PersistencePort
  ) {}

  async save(mission: Mission): Promise<void> {
    const filePath = this.missionPath(mission.id);
    await this.persistence.writeJson(filePath, mission);
  }

  async findById(missionId: string): Promise<Mission | null> {
    const filePath = this.missionPath(missionId);
    return this.persistence.readJson<Mission>(filePath);
  }

  async updateStatus(
    missionId: string,
    status: MissionStatus
  ): Promise<void> {
    const mission = await this.findById(missionId);
    if (!mission) return;
    const updated: Mission = {
      ...mission,
      status,
      updatedAt: new Date().toISOString(),
      completedAt:
        status === 'completed' || status === 'failed' || status === 'cancelled'
          ? new Date().toISOString()
          : mission.completedAt,
    };
    await this.save(updated);
  }

  private missionPath(missionId: string): string {
    return join(this.dataDir, 'missions', missionId, 'mission.json');
  }
}

export class FileTaskRepository implements TaskRepositoryPort {
  constructor(
    private readonly dataDir: string,
    private readonly persistence: PersistencePort
  ) {}

  async saveAll(missionId: string, tasks: Task[]): Promise<void> {
    const filePath = this.tasksPath(missionId);
    await this.persistence.writeJson(filePath, tasks);
  }

  async findByMissionId(missionId: string): Promise<Task[]> {
    const filePath = this.tasksPath(missionId);
    return (await this.persistence.readJson<Task[]>(filePath)) ?? [];
  }

  async findById(
    missionId: string,
    taskId: string
  ): Promise<Task | null> {
    const tasks = await this.findByMissionId(missionId);
    return tasks.find((t) => t.id === taskId) ?? null;
  }

  async update(missionId: string, task: Task): Promise<void> {
    const tasks = await this.findByMissionId(missionId);
    const idx = tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      tasks[idx] = task;
    } else {
      tasks.push(task);
    }
    await this.saveAll(missionId, tasks);
  }

  private tasksPath(missionId: string): string {
    return join(this.dataDir, 'missions', missionId, 'tasks.json');
  }
}
