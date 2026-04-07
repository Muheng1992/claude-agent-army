// src/adapters/session-spawner.ts
// WHY: 封裝 child_process.spawn('claude') 呼叫，管理 Claude CLI session 生命週期

import { spawn, execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { createSessionId } from '../domain/session.js';
import type {
  SessionManagerPort,
  SpawnOptions,
  SpawnResult,
} from '../application/ports/session-manager-port.js';

const execFileAsync = promisify(execFile);
const KILL_TIMEOUT_MS = 5000;
const WORKTREE_DIR = '.worktrees';

export class SessionSpawner implements SessionManagerPort {
  /** processId → ChildProcess */
  private readonly processes = new Map<number, ChildProcess>();

  /** processId → stdout 累計 */
  private readonly stdoutBuffers = new Map<number, string>();

  /** sessionId → worktree path（供清理用） */
  private readonly worktreePaths = new Map<string, string>();

  private readonly projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot ?? process.cwd();
  }

  async spawn(options: SpawnOptions): Promise<SpawnResult> {
    const sessionId = createSessionId();
    let workingDirectory = options.workingDirectory;
    let worktreePath: string | undefined;

    // WHY: implementer 使用 git worktree 隔離，避免平行 agent 之間的檔案衝突
    if (options.useWorktree) {
      worktreePath = await this.createWorktree(sessionId) ?? undefined;
      if (worktreePath) {
        workingDirectory = worktreePath;
        this.worktreePaths.set(sessionId, worktreePath);
      }
    }

    const model = options.agentDefinition?.model ?? options.model;

    const args = [
      '-p',
      '--output-format', 'text',
      '--model', model,
      '--max-turns', '200',
    ];

    if (options.maxBudgetUsd > 0) {
      args.push('--max-cost-usd', String(options.maxBudgetUsd));
    }

    const child = spawn('claude', args, {
      cwd: workingDirectory,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!child.pid) {
      throw new Error('Failed to spawn Claude CLI process');
    }

    this.processes.set(child.pid, child);
    this.stdoutBuffers.set(child.pid, '');

    child.stdout?.on('data', (data: Buffer) => {
      const existing = this.stdoutBuffers.get(child.pid!) ?? '';
      this.stdoutBuffers.set(child.pid!, existing + data.toString());
    });

    child.on('exit', () => {
      this.processes.delete(child.pid!);
    });

    // WHY: 若有 agentDefinition，將其 systemPrompt 前置到使用者 prompt
    const fullPrompt = options.agentDefinition
      ? `${options.agentDefinition.systemPrompt}\n\n---\n\n${options.prompt}`
      : options.prompt;

    child.stdin?.write(fullPrompt);
    child.stdin?.end();

    return { sessionId, processId: child.pid, worktreePath };
  }

  async kill(processId: number): Promise<void> {
    const child = this.processes.get(processId);
    if (!child) return;

    child.kill('SIGTERM');

    // SIGTERM 後等待，超時則 SIGKILL
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, KILL_TIMEOUT_MS);

      child.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.processes.delete(processId);
    this.stdoutBuffers.delete(processId);
  }

  async isAlive(processId: number): Promise<boolean> {
    try {
      // WHY: 傳送 signal 0 僅檢查 process 是否存在，不實際發送信號
      process.kill(processId, 0);
      return true;
    } catch {
      return false;
    }
  }

  async getRunningProcessIds(): Promise<number[]> {
    const alive: number[] = [];
    for (const pid of this.processes.keys()) {
      if (await this.isAlive(pid)) {
        alive.push(pid);
      }
    }
    return alive;
  }

  async waitForExit(processId: number): Promise<number> {
    const child = this.processes.get(processId);
    if (!child) return -1;

    return new Promise<number>((resolve) => {
      child.on('exit', (code) => {
        resolve(code ?? -1);
      });
    });
  }

  /** 取得 process 的 stdout 累計內容（供 recycle 時擷取結果） */
  getStdout(processId: number): string {
    return this.stdoutBuffers.get(processId) ?? '';
  }

  // CONSTRAINT: git worktree 操作可能失敗（如非 git repo），需降級到同目錄執行
  private async createWorktree(sessionId: string): Promise<string | null> {
    const worktreePath = `${this.projectRoot}/${WORKTREE_DIR}/${sessionId}`;
    const branchName = `worktree-${sessionId}`;

    try {
      await execFileAsync('git', [
        'worktree', 'add', worktreePath, '-b', branchName,
      ], { cwd: this.projectRoot });

      console.log(`[session-spawner] Created worktree at ${worktreePath}`);
      return worktreePath;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[session-spawner] Worktree creation failed, falling back to same directory: ${msg}`);
      return null;
    }
  }

  async cleanupWorktree(sessionId: string): Promise<void> {
    const worktreePath = this.worktreePaths.get(sessionId);
    if (!worktreePath) return;

    try {
      await execFileAsync('git', [
        'worktree', 'remove', worktreePath, '--force',
      ], { cwd: this.projectRoot });

      // WHY: 清理臨時分支，避免 branch 堆積
      const branchName = `worktree-${sessionId}`;
      await execFileAsync('git', [
        'branch', '-D', branchName,
      ], { cwd: this.projectRoot }).catch(() => {
        // WHY: 分支可能已被 merge 或刪除，忽略錯誤
      });

      this.worktreePaths.delete(sessionId);
      console.log(`[session-spawner] Cleaned up worktree for session ${sessionId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[session-spawner] Worktree cleanup failed for ${sessionId}: ${msg}`);
    }
  }

  /** 將 worktree 分支合併回主分支 */
  async mergeWorktree(sessionId: string): Promise<boolean> {
    const worktreePath = this.worktreePaths.get(sessionId);
    if (!worktreePath) return false;

    const branchName = `worktree-${sessionId}`;

    try {
      await execFileAsync('git', [
        'merge', branchName, '--no-edit',
      ], { cwd: this.projectRoot });

      console.log(`[session-spawner] Merged worktree branch ${branchName} back to main`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[session-spawner] Worktree merge failed for ${sessionId}: ${msg}`);
      return false;
    }
  }

  hasWorktree(sessionId: string): boolean {
    return this.worktreePaths.has(sessionId);
  }
}
