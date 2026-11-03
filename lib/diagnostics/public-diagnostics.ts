import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type DiagnosticSeverity = "error" | "warning" | "info";

type PublicDiagnosticInput = {
  source: string;
  message: string;
  severity?: DiagnosticSeverity;
  error?: unknown;
  digest?: string | null;
};

const diagnosticsLogPath =
  process.env.DIAGNOSTICS_LOG_FILE ||
  join(process.cwd(), "logs", "public-diagnostics.log");
const maxLogBytes = 512 * 1024;

function sanitize(value: string, maxLength = 280) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://[redacted]")
    .replace(/\b(bearer|token|secret|password|api[_-]?key)\s*[:=]?\s*[^\s,;"']+/gi, "$1=[redacted]")
    .replace(/[?&](?:token|secret|password|key|authorization)=[^\s&#]+/gi, "[redacted-query]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
    .replace(/\beyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){2}\b/g, "[redacted-token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: sanitize(error.name, 80) || "Error",
    };
  }

  return {
    name: "UnknownError",
  };
}

/**
 * Writes only redacted operational information. This file is intentionally
 * safe to publish through the credential-free diagnostics endpoint; do not add
 * request bodies, headers, database records, stack traces, or user data here.
 */
export async function recordPublicDiagnostic(input: PublicDiagnosticInput) {
  try {
    await mkdir(dirname(diagnosticsLogPath), { recursive: true });

    const current = await stat(diagnosticsLogPath).catch(() => null);
    if (current && current.size >= maxLogBytes) {
      await writeFile(
        diagnosticsLogPath,
        `${JSON.stringify({
          timestamp: new Date().toISOString(),
          severity: "warning",
          source: "diagnostics",
          message: "Log reset after reaching its size limit.",
        })}\n`,
        "utf8",
      );
    }

    const error = input.error === undefined ? null : describeError(input.error);
    const event = {
      timestamp: new Date().toISOString(),
      severity: input.severity ?? "error",
      source: sanitize(input.source, 120) || "application",
      message: sanitize(input.message) || "An application issue was detected.",
      ...(input.digest ? { digest: sanitize(input.digest, 120) } : {}),
      ...(error ? { error } : {}),
    };

    await appendFile(diagnosticsLogPath, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // Diagnostics must never hide or replace the application error being logged.
  }
}

export async function readPublicDiagnosticsLog() {
  try {
    return await readFile(diagnosticsLogPath, "utf8");
  } catch {
    return "";
  }
}

/** Records a redacted application request without query parameters or headers. */
export async function recordPublicRequest(method: string, pathname: string) {
  const safeMethod = method.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12) || "REQUEST";
  const safePath = pathname
    .split("?")[0]
    .split("/")
    .map((segment) => {
      if (/^[0-9]+$/.test(segment) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) {
        return "[id]";
      }
      return sanitize(segment, 80);
    })
    .join("/")
    .slice(0, 240);

  await recordPublicDiagnostic({
    source: "request",
    message: `${safeMethod} ${safePath || "/"}`,
    severity: "info",
  });
}
