import { NextResponse } from "next/server";

// GET /api/health — cheap liveness probe for AWS ALB / Docker HEALTHCHECK.
// Does not touch Postgres, Redis, or S3. Use /api/ready for dependency checks.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
