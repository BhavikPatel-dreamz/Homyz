import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import {
  setTravelProfileCover,
  removeTravelProfileCover,
} from "@/services/travel-profile.service";

const setCoverSchema = z.object({
  mediaAssetId: z.string().trim().min(1, "Media asset ID is required."),
});

export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const json = await req.json().catch(() => null);
  const parsed = setCoverSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Invalid cover image payload.",
        },
      },
      { status: 400 },
    );
  }

  const profile = await setTravelProfileCover(actor.id, parsed.data.mediaAssetId);
  return NextResponse.json({ profile }, { headers: { "Cache-Control": "private, no-store" } });
});

export const DELETE = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const profile = await removeTravelProfileCover(actor.id);
  return NextResponse.json({ profile }, { headers: { "Cache-Control": "private, no-store" } });
});

