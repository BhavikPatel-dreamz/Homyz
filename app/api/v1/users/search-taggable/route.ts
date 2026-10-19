import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { searchTaggableUsers } from "@/services/travel-photo-tag.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  const users = await searchTaggableUsers(actor.id, q);
  return NextResponse.json({ users }, {
    headers: { "Cache-Control": "private, no-store" },
  });
});

