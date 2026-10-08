import { runDailyGuestFavoriteEvaluation } from "@/services/guest-favorite.service";
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

// Called by the deployment scheduler once per day. The service persists an
// idempotent listing/day snapshot, so an operational retry is safe.
export async function POST(request: Request) {
  const secret = process.env.GUEST_FAVORITE_EVALUATION_CRON_SECRET;
  if (!hasValidCronAuthorization(request.headers.get("authorization"), secret)) {
    return Response.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    return Response.json({ success: true, data: await runDailyGuestFavoriteEvaluation() });
  } catch (error) {
    console.error("[guest-favorite-evaluation] endpoint failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({
      success: false,
      error: { message: "Unable to evaluate Guest Favorite status" },
    }, { status: 500 });
  }
}
