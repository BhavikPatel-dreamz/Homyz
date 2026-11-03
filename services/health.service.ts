import { prisma } from "@/lib/db/prisma";
import { recordPublicDiagnostic } from "@/lib/diagnostics/public-diagnostics";

export async function checkDatabaseReadiness(): Promise<"healthy" | "unavailable"> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "healthy";
  } catch (error) {
    await recordPublicDiagnostic({
      source: "database-readiness",
      message: "Database readiness query failed.",
      error,
      severity: "warning",
    });
    return "unavailable";
  }
}
