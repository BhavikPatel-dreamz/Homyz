import { prisma } from "@/lib/db/prisma";
import { pingRedis } from "@/lib/redis/client";

export type ProbeStatus = "healthy" | "unavailable" | "disabled";

export async function getReadiness() {
  const [database, redis] = await Promise.all([
    prisma
      .$queryRaw`SELECT 1`.then(() => "healthy" as const)
      .catch(() => "unavailable" as const),
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
