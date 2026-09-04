import { NextResponse } from "next/server";

import { apiHandler } from "@/lib/api/handler";
import { getReadiness } from "@/lib/health";

// GET /api/ready — readiness (Postgres required, Redis optional).
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
