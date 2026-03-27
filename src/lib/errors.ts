import { NextResponse } from "next/server";
import { logger } from "./logger";

const log = logger.child({ module: "error-handler" });

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterMs?: number;
  constructor(retryAfterMs?: number) {
    super("Too many requests", 429);
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Converts any error into a safe NextResponse — operational errors return
 * their message; unknown errors are logged and hidden behind a generic 500.
 */
export function apiError(
  err: unknown,
  context?: Record<string, unknown>
): NextResponse {
  if (err instanceof RateLimitError) {
    const headers: Record<string, string> = {};
    if (err.retryAfterMs) {
      headers["Retry-After"] = String(Math.ceil(err.retryAfterMs / 1000));
    }
    return NextResponse.json(
      { error: err.message },
      { status: err.statusCode, headers }
    );
  }

  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.message },
      { status: err.statusCode }
    );
  }

  log.error({ err, ...context }, "Internal server error");
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
