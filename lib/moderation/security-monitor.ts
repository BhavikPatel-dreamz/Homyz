import "server-only";

export type SecurityEventSeverity = "INFO" | "WARN" | "CRITICAL";

export interface SecurityEventInput {
  action: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  caseId?: string | null;
  severity?: SecurityEventSeverity;
  details?: Record<string, unknown>;
  error?: string | null;
}

const REDACTED_KEYS = new Set([
  "password",
  "token",
  "authorization",
  "secret",
  "cookie",
  "buffer",
  "body",
  "creditcard",
  "apikey",
]);

/**
 * Sanitizes arbitrary log metadata to protect sensitive personal data and credentials.
 */
export function sanitizeSecurityMetadata(obj: unknown, depth = 0): unknown {
  if (depth > 5) return "[DEPTH_LIMIT]";
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    // Truncate excessively long strings that might be base64 or raw payloads
    if (obj.length > 500) {
      return `${obj.slice(0, 100)}...[TRUNCATED ${obj.length} bytes]`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, 50).map((item) => sanitizeSecurityMetadata(item, depth + 1));
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (REDACTED_KEYS.has(lowerKey) || lowerKey.includes("secret") || lowerKey.includes("token")) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeSecurityMetadata(val, depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Emits a structured security audit and operational monitoring entry.
 */
export function logSecurityEvent(event: SecurityEventInput): void {
  const timestamp = new Date().toISOString();
  const severity = event.severity || "INFO";

  const payload = {
    timestamp,
    type: "SECURITY_AUDIT",
    severity,
    action: event.action,
    actorId: event.actorId || "ANONYMOUS",
    actorEmail: event.actorEmail || null,
    actorRole: event.actorRole || null,
    targetType: event.targetType || null,
    targetId: event.targetId || null,
    caseId: event.caseId || null,
    error: event.error || null,
    details: event.details ? sanitizeSecurityMetadata(event.details) : undefined,
  };

  if (severity === "CRITICAL") {
    console.error(`[SECURITY][CRITICAL] ${event.action}:`, JSON.stringify(payload));
  } else if (severity === "WARN") {
    console.warn(`[SECURITY][WARN] ${event.action}:`, JSON.stringify(payload));
  } else {
    // Info log
    console.info(`[SECURITY][INFO] ${event.action}:`, JSON.stringify(payload));
  }
}

