import { runQuarterlySuperhostEvaluation } from "@/services/superhost.service";

// This endpoint is intentionally internal. A deployment scheduler calls it on
// Jan 1, Apr 1, Jul 1, and Oct 1; the service itself rejects other dates.
export async function POST(request: Request) {
  const secret = process.env.SUPERHOST_EVALUATION_CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const result = await runQuarterlySuperhostEvaluation();
    return Response.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run Superhost evaluation";
    return Response.json({ success: false, error: { message } }, { status: 400 });
  }
}
