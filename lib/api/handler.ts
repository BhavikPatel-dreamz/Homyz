import type { NextRequest } from "next/server";
import { ZodError } from "zod";

import { AppError, ErrorCode, type ErrorDetail } from "./errors";
import { fail } from "./response";

function zodToDetails(err: ZodError): ErrorDetail[] {
  return err.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

/**
 * Wraps a route handler so every thrown error becomes a consistent JSON error
 * envelope with the correct status code. Keeps handlers thin: they only need to
 * authenticate → validate → authorize → call a service → return a success helper.
 *
 * Uses rest args so the wrapper transparently forwards Next.js's route context
 * (e.g. `{ params: Promise<{ id: string }> }`) with its original type.
 */
export function apiHandler<Args extends unknown[]>(
  fn: (req: NextRequest, ...args: Args) => Promise<Response> | Response,
) {
  return async (req: NextRequest, ...args: Args): Promise<Response> => {
    try {
      return await fn(req, ...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return fail(
          {
            code: ErrorCode.VALIDATION,
            message: "Validation failed",
            details: zodToDetails(err),
          },
          422,
        );
      }
      if (err instanceof AppError) {
        return fail(
          { code: err.code, message: err.message, details: err.details },
          err.status,
        );
      }
      // Unexpected: log server-side only, never expose internals to the client.
      console.error("[api] unhandled error:", err);
      return fail(
        { code: ErrorCode.INTERNAL, message: "Something went wrong" },
        500,
      );
    }
  };
}
