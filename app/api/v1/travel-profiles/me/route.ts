import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import {
  getTravelProfileByUserId,
  getTravelProfileStats,
  updateTravelProfile,
} from "@/services/travel-profile.service";

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profile, stats] = await Promise.all([
      getTravelProfileByUserId(actor.id),
      getTravelProfileStats(actor.id),
    ]);

    return NextResponse.json({ profile, stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load travel profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const updated = await updateTravelProfile(actor.id, {
      displayName: typeof body.displayName === "string" ? body.displayName : undefined,
      handle: typeof body.handle === "string" ? body.handle : undefined,
      bio: typeof body.bio === "string" ? body.bio : undefined,
      homeLocation: typeof body.homeLocation === "string" ? body.homeLocation : undefined,
      visibility: body.visibility,
    });

    return NextResponse.json({ success: true, profile: updated });
  } catch (err: any) {
    const status = err?.statusCode || (err?.code === "P2002" ? 409 : 400);
    const message = err?.message || "Failed to update travel profile";
    return NextResponse.json({ error: message }, { status });
  }
}

