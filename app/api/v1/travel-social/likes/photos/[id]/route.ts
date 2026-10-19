import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { getAuthContext } from "@/lib/auth/context";
import { travelSocialLikesService } from "@/services/travel-social-likes.service";

export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;
  const result = await travelSocialLikesService.togglePhotoLike(actor.id, id);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
});

export const GET = apiHandler(async (req, { params }) => {
  const actor = await getAuthContext(req);
  const { id } = await params;
  const result = await travelSocialLikesService.getPhotoLikeStatus(actor?.id || null, id);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
});

