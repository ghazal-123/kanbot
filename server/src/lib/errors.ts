import type { ErrorCode } from '../types/api.js';

/** An error that maps directly to an HTTP response: `{ error: { code, message, details? } }`. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
export const badRequest = (message: string, path?: string) =>
  new AppError(400, 'VALIDATION_ERROR', message, path ? [{ path, message }] : undefined);

/** The AI provider failed. Never 401: the frontend treats 401 as "session expired". */
export const aiError = (message: string) => new AppError(502, 'AI_ERROR', message);
