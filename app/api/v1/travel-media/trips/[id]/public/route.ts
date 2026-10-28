import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { AppError } from "@/lib/api/errors";
import { getTravelTripDetails } from "@/services/travel-social.service";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/travel-media/trips/[id]/public">) {
  try {
    const actor = await getAuthContext(req);
    const { id } = await ctx.params;
    return NextResponse.json({ trip: await getTravelTripDetails(actor?.id, id) });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to load trip." }, { status: 500 });
  }
}
