// src/application/ports/session-manager-port.ts

import type { AgentRole } from "../../domain/task.js";
import type { AgentDefinition } from "../../domain/agent-role.js";

export interface SpawnOptions {
  readonly model: string;
  readonly prompt: string;
  readonly workingDirectory: string;
  readonly maxBudgetUsd: number;
  readonly env: Record<string, string>;
  readonly role: AgentRole;
  readonly agentDefinition?: AgentDefinition;
  readonly useWorktree?: boolean;
}

export interface SpawnResult {
  readonly sessionId: string;
  readonly processId: number;
  readonly worktreePath?: string;
}

export interface SessionManagerPort {
  spawn(options: SpawnOptions): Promise<SpawnResult>;
  kill(processId: number): Promise<void>;
  isAlive(processId: number): Promise<boolean>;
  getRunningProcessIds(): Promise<number[]>;
  waitForExit(processId: number): Promise<number>;
  cleanupWorktree?(sessionId: string): Promise<void>;
}
