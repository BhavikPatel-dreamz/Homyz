import { NextResponse } from "next/server";

import {
  readPublicDiagnosticsLog,
  recordPublicDiagnostic,
} from "@/lib/diagnostics/public-diagnostics";
import { getReadiness } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/diagnostics.log — intentionally credential-free, sanitized runtime diagnostics.
// This must only return data produced by public-diagnostics.ts.
export async function GET() {
  const readiness = await getReadiness();
  if (!readiness.healthy) {
    await recordPublicDiagnostic({
      source: "readiness",
      message: `Dependency health check is degraded (database: ${readiness.database}, redis: ${readiness.redis}).`,
      severity: "warning",
    });
  }

  const log = await readPublicDiagnosticsLog();
  const body = [
    "# Homyz public diagnostics (redacted)",
    `# generated-at: ${new Date().toISOString()}`,
    `# database: ${readiness.database}`,
    `# redis: ${readiness.redis}`,
    "# Latest redacted request, readiness, and error events. No database records, credentials, request bodies, headers, or stack traces.",
    "",
    log.trim() || "# No diagnostics have been recorded yet.",
    "",
  ].join("\n");

  return new NextResponse(body, {
    status: readiness.healthy ? 200 : 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
