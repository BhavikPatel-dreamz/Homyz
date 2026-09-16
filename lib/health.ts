import { pingRedis } from "@/lib/redis/client";
import { checkDatabaseReadiness } from "@/services/health.service";

export type ProbeStatus = "healthy" | "unavailable" | "disabled";

export async function getReadiness() {
  const [database, redis] = await Promise.all([
    checkDatabaseReadiness(),
    pingRedis(),
  ]);

  const healthy = database === "healthy";
  return {
    healthy,
    status: healthy ? ("ok" as const) : ("degraded" as const),
    database,
    redis: redis as ProbeStatus,
  };
}
