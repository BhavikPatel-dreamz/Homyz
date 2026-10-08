import { runQuarterlySuperhostEvaluation } from "@/services/superhost.service";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasValidCronAuthorization(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = `Bearer ${secret}`;
  const supplied = Buffer.from(authorization);
  const expectedValue = Buffer.from(expected);
  return supplied.length === expectedValue.length && timingSafeEqual(supplied, expectedValue);
}

// This endpoint is intentionally internal. A deployment scheduler calls it on
// Jan 1, Apr 1, Jul 1, and Oct 1 (or during the 7-day quarterly assessment window);
// the service rejects other dates outside the window.
export async function POST(request: Request) {
  const secret = process.env.SUPERHOST_EVALUATION_CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!hasValidCronAuthorization(authorization, secret)) {
    return Response.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const result = await runQuarterlySuperhostEvaluation();
    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error("[superhost-evaluation] internal endpoint failed", error);
    const message = error instanceof Error ? error.message : "Unable to run Superhost evaluation";
    return Response.json({ success: false, error: { message } }, { status: 400 });
  }
}
