// src/application/use-cases/verify-task.ts
// WHY: 驗證已完成 task 的 acceptance criteria，透過 checkCommand 自動驗證

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { TaskRepositoryPort } from '../ports/mission-repository-port.js';
import type { ContextLedgerPort } from '../ports/context-ledger-port.js';
import { ApplicationError } from '../errors.js';
import { createArtifact } from '../../domain/context-ledger.js';

const execAsync = promisify(exec);

// CONSTRAINT: 單一 checkCommand 的執行上限為 30 秒，避免阻塞 orchestrator
const CHECK_COMMAND_TIMEOUT_MS = 30_000;

export interface VerifyTaskInput {
  readonly missionId: string;
  readonly taskId: string;
  readonly workingDirectory?: string;
}

export interface VerifyTaskOutput {
  readonly passed: boolean;
  readonly reason: string;
  readonly checkResults: Array<{
    readonly criteria: string;
    readonly passed: boolean;
    readonly detail: string;
  }>;
}

interface VerifyTaskDeps {
  readonly taskRepo: TaskRepositoryPort;
  readonly ledgerPort: ContextLedgerPort;
}

export class VerifyTaskUseCase {
  constructor(private readonly deps: VerifyTaskDeps) {}

  async execute(input: VerifyTaskInput): Promise<VerifyTaskOutput> {
    const task = await this.deps.taskRepo.findById(
      input.missionId,
      input.taskId
    );

    if (!task) {
      throw new ApplicationError(
        'TASK_NOT_FOUND',
        `Task ${input.taskId} not found in mission ${input.missionId}`
      );
    }

    const checkResults: VerifyTaskOutput['checkResults'] = [];

    for (const criteria of task.acceptanceCriteria) {
      if (!criteria.checkCommand) {
        // WHY: 沒有 checkCommand 的 criteria 預設通過，由人工判斷
        checkResults.push({
          criteria: criteria.description,
          passed: true,
          detail: 'No check command — assumed passed',
        });
        continue;
      }

      const result = await this.runCheckCommand(
        criteria.checkCommand,
        criteria.description,
        input.workingDirectory
      );
      checkResults.push(result);
    }

    const allPassed = checkResults.every((r) => r.passed);
    const failedCount = checkResults.filter((r) => !r.passed).length;

    const reason = allPassed
      ? `All ${checkResults.length} criteria passed`
      : `${failedCount} of ${checkResults.length} criteria failed`;

    await this.recordVerificationArtifact(input, allPassed, checkResults);

    return { passed: allPassed, reason, checkResults };
  }

  private async runCheckCommand(
    command: string,
    description: string,
    cwd?: string
  ): Promise<VerifyTaskOutput['checkResults'][number]> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: CHECK_COMMAND_TIMEOUT_MS,
        cwd,
      });

      return {
        criteria: description,
        passed: true,
        detail: (stdout || stderr).trim().slice(0, 500),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        criteria: description,
        passed: false,
        detail: message.slice(0, 500),
      };
    }
  }

  private async recordVerificationArtifact(
    input: VerifyTaskInput,
    passed: boolean,
    results: VerifyTaskOutput['checkResults']
  ): Promise<void> {
    const summary = results
      .map((r) => `[${r.passed ? 'PASS' : 'FAIL'}] ${r.criteria}: ${r.detail}`)
      .join('\n');

    const artifact = createArtifact({
      sessionId: '',
      taskId: input.taskId,
      type: passed ? 'summary' : 'error',
      content: `Verification ${passed ? 'passed' : 'failed'}:\n${summary}`,
    });
    await this.deps.ledgerPort.addArtifact(input.missionId, artifact);
  }
}
