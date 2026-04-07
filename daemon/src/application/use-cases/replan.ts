// src/application/use-cases/replan.ts
// WHY: 處理失敗的 task — 決定 retry 或 abandon，並串聯下游 task

import { createDaemonEvent } from '../../domain/daemon-event.js';
import { canTransitionTo } from '../../domain/task.js';
import type { Task } from '../../domain/task.js';
import {
  createTaskGraph,
  getReadyTasks,
  isTerminal,
} from '../../domain/task-graph.js';
import type {
  MissionRepositoryPort,
  TaskRepositoryPort,
} from '../ports/mission-repository-port.js';
import type { EventBusPort } from '../ports/event-bus-port.js';
import { ApplicationError } from '../errors.js';

export interface ReplanInput {
  readonly missionId: string;
  readonly failedTaskIds: string[];
}

export interface ReplanOutput {
  readonly retriedTaskIds: string[];
  readonly abandonedTaskIds: string[];
  readonly missionContinues: boolean;
}

interface ReplanDeps {
  readonly taskRepo: TaskRepositoryPort;
  readonly missionRepo: MissionRepositoryPort;
  readonly eventBus: EventBusPort;
}

export class ReplanUseCase {
  constructor(private readonly deps: ReplanDeps) {}

  async execute(input: ReplanInput): Promise<ReplanOutput> {
    const allTasks = await this.deps.taskRepo.findByMissionId(input.missionId);
    const retriedTaskIds: string[] = [];
    const abandonedTaskIds: string[] = [];

    for (const failedTaskId of input.failedTaskIds) {
      const task = allTasks.find((t) => t.id === failedTaskId);
      if (!task) {
        throw new ApplicationError(
          'TASK_NOT_FOUND',
          `Task ${failedTaskId} not found in mission ${input.missionId}`
        );
      }

      if (task.retryCount < task.maxRetries) {
        await this.retryTask(input.missionId, task);
        retriedTaskIds.push(failedTaskId);
      } else {
        const cascaded = await this.abandonTask(
          input.missionId,
          task,
          allTasks
        );
        abandonedTaskIds.push(failedTaskId, ...cascaded);
      }
    }

    // WHY: 檢查是否仍有可執行的 task，決定 mission 是否繼續
    const updatedTasks = await this.deps.taskRepo.findByMissionId(
      input.missionId
    );
    const taskGraph = createTaskGraph(
      updatedTasks.map((t) => ({
        id: t.id,
        status: t.status,
        dependencies: t.dependencies,
      }))
    );
    const hasReadyTasks = getReadyTasks(taskGraph).length > 0;
    const graphIsTerminal = isTerminal(taskGraph);
    const missionContinues = hasReadyTasks || !graphIsTerminal;

    if (!missionContinues) {
      await this.deps.missionRepo.updateStatus(input.missionId, 'failed');
      this.deps.eventBus.emit(
        createDaemonEvent('mission:failed', {
          missionId: input.missionId,
          reason: `${abandonedTaskIds.length} task(s) abandoned after max retries`,
        })
      );
      console.log(
        `[replan] Mission ${input.missionId} marked failed — no work remains`
      );
    }

    return { retriedTaskIds, abandonedTaskIds, missionContinues };
  }

  private async retryTask(
    missionId: string,
    task: Task
  ): Promise<void> {
    if (!canTransitionTo(task.status, 'retrying')) {
      throw new ApplicationError(
        'INVALID_TRANSITION',
        `Cannot transition task ${task.id} from ${task.status} to retrying`
      );
    }

    // CONTEXT: orchestrator 需重新指派，故直接設回 pending 讓 assignReadyTasks 接手
    const updatedTask: Task = {
      ...task,
      status: 'pending',
      retryCount: task.retryCount + 1,
      assignedSessionId: null,
    };

    await this.deps.taskRepo.update(missionId, updatedTask);

    this.deps.eventBus.emit(
      createDaemonEvent('task:retrying', {
        missionId,
        taskId: task.id,
        retryCount: updatedTask.retryCount,
        maxRetries: task.maxRetries,
      })
    );

    console.log(
      `[replan] Task ${task.id} scheduled for retry ` +
      `(attempt ${updatedTask.retryCount}/${task.maxRetries})`
    );
  }

  private async abandonTask(
    missionId: string,
    task: Task,
    allTasks: Task[]
  ): Promise<string[]> {
    if (!canTransitionTo(task.status, 'abandoned')) {
      throw new ApplicationError(
        'INVALID_TRANSITION',
        `Cannot transition task ${task.id} from ${task.status} to abandoned`
      );
    }

    const abandonedTask: Task = { ...task, status: 'abandoned' };
    await this.deps.taskRepo.update(missionId, abandonedTask);

    this.deps.eventBus.emit(
      createDaemonEvent('task:abandoned', {
        missionId,
        taskId: task.id,
        reason: `Max retries (${task.maxRetries}) exceeded`,
      })
    );

    console.log(
      `[replan] Task ${task.id} abandoned after ${task.retryCount} retries`
    );

    // WHY: 串聯放棄所有直接/間接依賴此 task 的下游 task
    const cascaded = this.findDownstreamTasks(task.id, allTasks);
    for (const downstream of cascaded) {
      if (downstream.status === 'pending') {
        const abandonedDownstream: Task = {
          ...downstream,
          status: 'abandoned',
          lastError: `Cascade-abandoned: dependency ${task.id} was abandoned`,
        };
        await this.deps.taskRepo.update(missionId, abandonedDownstream);
        console.log(
          `[replan] Task ${downstream.id} cascade-abandoned ` +
          `(depends on ${task.id})`
        );
      }
    }

    return cascaded.map((t) => t.id);
  }

  /** 找出所有直接/間接依賴指定 task 的下游 task */
  private findDownstreamTasks(taskId: string, allTasks: Task[]): Task[] {
    const downstream: Task[] = [];
    const visited = new Set<string>();
    const queue = [taskId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const task of allTasks) {
        if (visited.has(task.id)) continue;
        if (task.dependencies.includes(current)) {
          visited.add(task.id);
          downstream.push(task);
          queue.push(task.id);
        }
      }
    }

    return downstream;
  }
}
