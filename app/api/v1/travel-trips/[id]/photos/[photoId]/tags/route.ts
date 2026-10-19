import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { listPhotoTags, addPhotoTag } from "@/services/travel-photo-tag.service";
import { addPhotoTagSchema } from "@/lib/validation/travel-trip";

export const dynamic = "force-dynamic";

export const GET = apiHandler(
  async (
    req,
    { params }: { params: Promise<{ id: string; photoId: string }> },
  ) => {
    const actor = await requireApiAuth(req);
    const { photoId } = await params;
    const tags = await listPhotoTags(actor.id, photoId);
    return NextResponse.json({ tags }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  },
);

export const POST = apiHandler(
  async (
    req,
    { params }: { params: Promise<{ id: string; photoId: string }> },
  ) => {
    const actor = await requireApiAuth(req);
    const { photoId } = await params;
    const json = await req.json().catch(() => null);
    const parsed = addPhotoTagSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "Invalid tag payload.",
          },
        },
        { status: 400 },
      );
    }

    const tag = await addPhotoTag(actor.id, photoId, parsed.data.taggedUserId);
    return NextResponse.json({ tag }, {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  },
);

