// Domain Layer — ContextLedger Value Object

export interface Artifact {
  readonly id: string;
  readonly sessionId: string;
  readonly taskId: string;
  readonly type: "code" | "decision" | "error" | "summary" | "progress";
  readonly content: string;
  readonly createdAt: string;
}

export interface Decision {
  readonly id: string;
  readonly sessionId: string;
  readonly taskId: string;
  readonly summary: string;
  readonly rationale: string;
  readonly affectedFiles: string[];
  readonly createdAt: string;
}

export interface SessionContext {
  readonly sessionId: string;
  readonly taskId: string;
  tokenEstimate: number;
  readonly filesRead: string[];
  readonly filesWritten: string[];
  status: "running" | "completed" | "recycled" | "failed";
}

export interface ContextLedger {
  readonly missionId: string;
  readonly sessions: SessionContext[];
  readonly artifacts: Artifact[];
  readonly decisions: Decision[];
}

export function createLedger(missionId: string): ContextLedger {
  return {
    missionId,
    sessions: [],
    artifacts: [],
    decisions: [],
  };
}

export function addArtifact(
  ledger: ContextLedger,
  artifact: Artifact
): ContextLedger {
  return {
    ...ledger,
    artifacts: [...ledger.artifacts, artifact],
  };
}

export function addDecision(
  ledger: ContextLedger,
  decision: Decision
): ContextLedger {
  return {
    ...ledger,
    decisions: [...ledger.decisions, decision],
  };
}

export function updateSessionContext(
  ledger: ContextLedger,
  sessionContext: SessionContext
): ContextLedger {
  const existing = ledger.sessions.findIndex(
    (s) => s.sessionId === sessionContext.sessionId
  );

  if (existing === -1) {
    return {
      ...ledger,
      sessions: [...ledger.sessions, sessionContext],
    };
  }

  const updatedSessions = [...ledger.sessions];
  updatedSessions[existing] = sessionContext;
  return {
    ...ledger,
    sessions: updatedSessions,
  };
}

export function getArtifactsForTask(
  ledger: ContextLedger,
  taskId: string
): Artifact[] {
  return ledger.artifacts.filter((a) => a.taskId === taskId);
}

export function getRelevantDecisions(
  ledger: ContextLedger,
  taskId: string
): Decision[] {
  return ledger.decisions.filter((d) => d.taskId === taskId);
}

export function getSessionContext(
  ledger: ContextLedger,
  sessionId: string
): SessionContext | undefined {
  return ledger.sessions.find((s) => s.sessionId === sessionId);
}

function generateArtifactId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `artifact-${timestamp}-${random}`;
}

export function createArtifact(params: {
  sessionId: string;
  taskId: string;
  type: Artifact["type"];
  content: string;
}): Artifact {
  return {
    id: generateArtifactId(),
    sessionId: params.sessionId,
    taskId: params.taskId,
    type: params.type,
    content: params.content,
    createdAt: new Date().toISOString(),
  };
}

function generateDecisionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `decision-${timestamp}-${random}`;
}

export function createDecision(params: {
  sessionId: string;
  taskId: string;
  summary: string;
  rationale: string;
  affectedFiles?: string[];
}): Decision {
  return {
    id: generateDecisionId(),
    sessionId: params.sessionId,
    taskId: params.taskId,
    summary: params.summary,
    rationale: params.rationale,
    affectedFiles: params.affectedFiles ?? [],
    createdAt: new Date().toISOString(),
  };
}
