// Typed application errors. Services / guards throw these; `apiHandler` maps
// them to the JSON error envelope with the right HTTP status. Never leak
// stack traces or internals to clients.

export const ErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION: "VALIDATION",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorDetail {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetail[];

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static badRequest(message = "Bad request", details?: ErrorDetail[]) {
    return new AppError(ErrorCode.BAD_REQUEST, message, 400, details);
  }
  static validation(message = "Validation failed", details?: ErrorDetail[]) {
    return new AppError(ErrorCode.VALIDATION, message, 422, details);
  }
  static unauthorized(message = "Authentication required") {
    return new AppError(ErrorCode.UNAUTHORIZED, message, 401);
  }
  static forbidden(message = "You do not have permission to perform this action") {
    return new AppError(ErrorCode.FORBIDDEN, message, 403);
  }
  static notFound(message = "Resource not found") {
    return new AppError(ErrorCode.NOT_FOUND, message, 404);
  }
  static conflict(message = "Resource already exists") {
    return new AppError(ErrorCode.CONFLICT, message, 409);
  }
  static rateLimited(message = "Too many requests. Please try again later.") {
    return new AppError(ErrorCode.RATE_LIMITED, message, 429);
  }
  static internal(message = "Something went wrong") {
    return new AppError(ErrorCode.INTERNAL, message, 500);
  }
}
