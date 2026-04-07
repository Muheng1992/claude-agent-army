// Domain Layer — Session Entity

export type SessionStatus =
  | "spawning"
  | "running"
  | "recycling"
  | "completed"
  | "failed"
  | "killed";

export interface Session {
  readonly id: string;
  readonly taskId: string;
  readonly missionId: string;
  processId: number | null;
  readonly model: string;
  tokenEstimate: number;
  status: SessionStatus;
  readonly spawnedAt: string;
  lastHeartbeatAt: string;
  completedAt: string | null;
  exitCode: number | null;
  readonly recycledFrom: string | null;
}

function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `session-${timestamp}-${random}`;
}

export function createSessionId(): string {
  return generateSessionId();
}

export function createSession(params: {
  taskId: string;
  missionId: string;
  model: string;
  recycledFrom?: string | null;
}): Session {
  const now = new Date().toISOString();
  return {
    id: generateSessionId(),
    taskId: params.taskId,
    missionId: params.missionId,
    processId: null,
    model: params.model,
    tokenEstimate: 0,
    status: "spawning",
    spawnedAt: now,
    lastHeartbeatAt: now,
    completedAt: null,
    exitCode: null,
    recycledFrom: params.recycledFrom ?? null,
  };
}

export function addTokens(session: Session, count: number): Session {
  return {
    ...session,
    tokenEstimate: session.tokenEstimate + count,
  };
}

export function shouldRecycle(session: Session, threshold: number): boolean {
  return session.tokenEstimate >= threshold;
}

export function markRunning(session: Session, processId: number): Session {
  return {
    ...session,
    status: "running",
    processId,
    lastHeartbeatAt: new Date().toISOString(),
  };
}

export function markCompleted(session: Session, exitCode: number): Session {
  return {
    ...session,
    status: "completed",
    completedAt: new Date().toISOString(),
    exitCode,
  };
}

export function markFailed(session: Session, exitCode: number | null): Session {
  return {
    ...session,
    status: "failed",
    completedAt: new Date().toISOString(),
    exitCode,
  };
}

export function markRecycling(session: Session): Session {
  return {
    ...session,
    status: "recycling",
  };
}

export function markKilled(session: Session): Session {
  return {
    ...session,
    status: "killed",
    completedAt: new Date().toISOString(),
  };
}

export function updateHeartbeat(session: Session): Session {
  return {
    ...session,
    lastHeartbeatAt: new Date().toISOString(),
  };
}

export function isActiveSession(session: Session): boolean {
  return session.status === "spawning" || session.status === "running";
}
