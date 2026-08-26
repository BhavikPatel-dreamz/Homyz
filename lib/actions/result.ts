import { ZodError } from "zod";

import { AppError } from "@/lib/api/errors";

// Form-friendly result type for Server Actions. Mirrors the API envelope's
// philosophy (never leak internals) but shaped for progressive-enhancement
// forms: a top-level message plus optional per-field errors.
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Runs a Server Action body and normalizes thrown errors into an ActionResult.
 * ZodError → field errors; AppError → its safe message; anything else → a
 * generic message (logged server-side only).
 */
export async function runAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.map(String).join(".") || "_";
        fieldErrors[key] ??= issue.message;
      }
      return { ok: false, error: "Validation failed", fieldErrors };
    }
    if (err instanceof AppError) {
      return { ok: false, error: err.message };
    }
    console.error("[action] unhandled error:", err);
    return { ok: false, error: "Something went wrong" };
  }
}
