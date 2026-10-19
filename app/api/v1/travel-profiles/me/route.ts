import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import {
  getOrCreateTravelProfile,
  updateTravelProfile,
} from "@/services/travel-profile.service";
import { updateTravelProfileSchema } from "@/lib/validation/travel-trip";

export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const profile = await getOrCreateTravelProfile(actor.id);
  return NextResponse.json({ profile }, { headers: { "Cache-Control": "private, no-store" } });
});

export const PATCH = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const json = await req.json().catch(() => null);
  const parsed = updateTravelProfileSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Invalid travel profile update.",
          details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 400 },
    );
  }

  const profile = await updateTravelProfile(actor.id, parsed.data);
  return NextResponse.json({ profile }, { headers: { "Cache-Control": "private, no-store" } });
});

