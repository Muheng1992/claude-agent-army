// src/application/errors.ts

export class ApplicationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}
