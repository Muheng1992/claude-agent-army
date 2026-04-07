// src/application/ports/git-checkpoint-port.ts

export interface GitCheckpointPort {
  commit(message: string): Promise<string>;
  getCurrentHead(): Promise<string>;
}
