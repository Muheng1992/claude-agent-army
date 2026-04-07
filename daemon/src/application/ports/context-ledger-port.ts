// src/application/ports/context-ledger-port.ts

import type {
  Artifact,
  ContextLedger,
  Decision,
  SessionContext,
} from "../../domain/context-ledger.js";

export interface ContextLedgerPort {
  load(missionId: string): Promise<ContextLedger>;
  save(ledger: ContextLedger): Promise<void>;
  addArtifact(missionId: string, artifact: Artifact): Promise<void>;
  addDecision(missionId: string, decision: Decision): Promise<void>;
  upsertSessionContext(
    missionId: string,
    sessionContext: SessionContext
  ): Promise<void>;
  getArtifactsForTask(
    missionId: string,
    taskId: string
  ): Promise<Artifact[]>;
  getDecisionsForTask(
    missionId: string,
    taskId: string
  ): Promise<Decision[]>;
}
