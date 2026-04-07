// Domain Layer — Error Types

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function invalidTransition(from: string, to: string): DomainError {
  return new DomainError(
    "INVALID_TRANSITION",
    `Cannot transition from "${from}" to "${to}"`
  );
}

export function cycleDetected(): DomainError {
  return new DomainError(
    "CYCLE_DETECTED",
    "TaskGraph contains a cycle"
  );
}

export function taskNotFound(taskId: string): DomainError {
  return new DomainError(
    "TASK_NOT_FOUND",
    `Task "${taskId}" not found in graph`
  );
}

export function missionNotFound(missionId: string): DomainError {
  return new DomainError(
    "MISSION_NOT_FOUND",
    `Mission "${missionId}" not found`
  );
}
