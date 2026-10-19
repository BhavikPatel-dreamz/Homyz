import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { removePhotoTag } from "@/services/travel-photo-tag.service";

export const dynamic = "force-dynamic";

export const DELETE = apiHandler(
  async (
    req,
    { params }: { params: Promise<{ id: string; photoId: string; tagId: string }> },
  ) => {
    const actor = await requireApiAuth(req);
    const { photoId, tagId } = await params;
    const result = await removePhotoTag(actor.id, photoId, tagId);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  },
);

