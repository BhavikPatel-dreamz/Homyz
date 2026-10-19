import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelSocialLikesService } from "@/services/travel-social-likes.service";

export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const [likedProfiles, likedPhotos] = await Promise.all([
    travelSocialLikesService.getUserLikedProfiles(actor.id),
    travelSocialLikesService.getUserLikedPhotos(actor.id),
  ]);

  return NextResponse.json(
    {
      likedProfiles: likedProfiles.items,
      likedPhotos: likedPhotos.items,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});

