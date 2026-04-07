// src/adapters/git-checkpoint.ts
// WHY: 簡單的 git 操作封裝，用於 task 完成時建立 checkpoint commit

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitCheckpointPort } from '../application/ports/git-checkpoint-port.js';

const execFileAsync = promisify(execFile);

export class GitCheckpoint implements GitCheckpointPort {
  constructor(private readonly workingDirectory: string) {}

  async commit(message: string): Promise<string> {
    // Stage all changes
    await execFileAsync('git', ['add', '-A'], {
      cwd: this.workingDirectory,
    });

    // Commit
    await execFileAsync('git', ['commit', '-m', message, '--allow-empty'], {
      cwd: this.workingDirectory,
    });

    // Return commit hash
    return this.getCurrentHead();
  }

  async getCurrentHead(): Promise<string> {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-parse', 'HEAD'],
      { cwd: this.workingDirectory }
    );
    return stdout.trim();
  }
}
