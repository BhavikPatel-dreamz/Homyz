import { NextResponse } from "next/server";

import { apiHandler } from "@/lib/api/handler";
import { getReadiness } from "@/lib/health";

// GET /api/v1/health — readiness probe (same payload as /api/ready).
// Load balancers should use GET /api/health (no database). This route still
// checks Postgres; Redis remaining optional never fails the probe.
export const GET = apiHandler(async () => {
  const result = await getReadiness();
  return NextResponse.json(
    {
      success: result.healthy,
      data: {
        status: result.status,
        database: result.database,
        redis: result.redis,
      },
    },
    { status: result.healthy ? 200 : 503 },
  );
});
