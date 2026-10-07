import { runDailyGuestFavoriteEvaluation } from "@/services/guest-favorite.service";

// Called by the deployment scheduler once per day. The service persists an
// idempotent listing/day snapshot, so an operational retry is safe.
export async function POST(request: Request) {
  const secret = process.env.GUEST_FAVORITE_EVALUATION_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    return Response.json({ success: true, data: await runDailyGuestFavoriteEvaluation() });
  } catch (error) {
    return Response.json({
      success: false,
      error: { message: error instanceof Error ? error.message : "Unable to evaluate Guest Favorite status" },
    }, { status: 500 });
  }
}
