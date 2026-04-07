// src/adapters/file-context-store.ts
// WHY: 實作 ContextLedgerPort，將 ledger 持久化為 JSON 檔案

import { join } from 'node:path';
import type { Artifact, ContextLedger, Decision, SessionContext } from '../domain/context-ledger.js';
import { createLedger } from '../domain/context-ledger.js';
import type { ContextLedgerPort } from '../application/ports/context-ledger-port.js';
import type { PersistencePort } from '../application/ports/persistence-port.js';

export class FileContextStore implements ContextLedgerPort {
  constructor(
    private readonly dataDir: string,
    private readonly persistence: PersistencePort
  ) {}

  async load(missionId: string): Promise<ContextLedger> {
    const filePath = this.ledgerPath(missionId);
    const ledger = await this.persistence.readJson<ContextLedger>(filePath);
    return ledger ?? createLedger(missionId);
  }

  async save(ledger: ContextLedger): Promise<void> {
    const filePath = this.ledgerPath(ledger.missionId);
    await this.persistence.writeJson(filePath, ledger);
  }

  async addArtifact(missionId: string, artifact: Artifact): Promise<void> {
    const ledger = await this.load(missionId);
    const updated: ContextLedger = {
      ...ledger,
      artifacts: [...ledger.artifacts, artifact],
    };
    await this.save(updated);
  }

  async addDecision(missionId: string, decision: Decision): Promise<void> {
    const ledger = await this.load(missionId);
    const updated: ContextLedger = {
      ...ledger,
      decisions: [...ledger.decisions, decision],
    };
    await this.save(updated);
  }

  async upsertSessionContext(
    missionId: string,
    sessionContext: SessionContext
  ): Promise<void> {
    const ledger = await this.load(missionId);
    const idx = ledger.sessions.findIndex(
      (s) => s.sessionId === sessionContext.sessionId
    );
    const sessions = [...ledger.sessions];
    if (idx >= 0) {
      sessions[idx] = sessionContext;
    } else {
      sessions.push(sessionContext);
    }
    const updated: ContextLedger = { ...ledger, sessions };
    await this.save(updated);
  }

  async getArtifactsForTask(
    missionId: string,
    taskId: string
  ): Promise<Artifact[]> {
    const ledger = await this.load(missionId);
    return ledger.artifacts.filter((a) => a.taskId === taskId);
  }

  async getDecisionsForTask(
    missionId: string,
    taskId: string
  ): Promise<Decision[]> {
    const ledger = await this.load(missionId);
    return ledger.decisions.filter((d) => d.taskId === taskId);
  }

  private ledgerPath(missionId: string): string {
    return join(this.dataDir, 'missions', missionId, 'ledger.json');
  }
}
