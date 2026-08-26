import { NextResponse } from "next/server";

import { apiHandler } from "@/lib/api/handler";
import { prisma } from "@/lib/db/prisma";
import { pingRedis } from "@/lib/redis/client";

// GET /api/v1/health — liveness/readiness probe.
//
// The app is considered healthy whenever the DATABASE is reachable; Redis is an
// optional cache, so "disabled" or "unavailable" Redis never fails the check
// (spec §18). Returns 200 when the database is up, 503 when it is not. Public;
// exposes status strings only, never connection details or secrets.
//
// Route handlers are not cached by default in this Next.js, so this runs per
// request without any route-segment config.
export const GET = apiHandler(async () => {
  const [database, redis] = await Promise.all([
    prisma
      .$queryRaw`SELECT 1`.then(() => "healthy" as const)
      .catch(() => "unavailable" as const),
    pingRedis(),
  ]);

  const healthy = database === "healthy";
  return NextResponse.json(
    {
      success: healthy,
      data: { status: healthy ? "ok" : "degraded", database, redis },
    },
    { status: healthy ? 200 : 503 },
  );
});
