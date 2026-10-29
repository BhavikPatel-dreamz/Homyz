"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { userService } from "@/services/user.service";

import { prisma } from "@/lib/db/prisma";

import { getTravelPhotos, deleteTravelPhoto, updateTravelPhotoMetadata } from "@/services/travel-photo.service";

function revalidateTravelViews() {
  revalidatePath("/profile");
  revalidatePath("/profile/tab/profile_management/trip_photos");
  revalidatePath("/profile-management");
  revalidatePath("/travel-profile");
  revalidatePath("/travelers/[handle]", "page");
}

export async function getTripPhotosAction(targetUserId?: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    let userId = targetUserId;
    if (!userId) {
      if (!actor) throw AppError.unauthorized();
      userId = actor.id;
    } else if (actor?.id !== userId && actor?.role !== "ADMIN") {
      // Visitor-facing data is projected by the privacy-filtered public
      // profile service. Never return raw management records to a visitor.
      throw AppError.forbidden("This management gallery is only available to its owner.");
    }
    return getTravelPhotos(userId);
  });
}

export async function uploadTripPhotosAction(
  photos: Array<{ url: string; caption?: string; location?: string; taggedUserIds?: string[] }>
) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    // Old clients may upload through the secure TravelPhoto endpoint first and
    // then call this URL-based compatibility action. Reuse those rows so the
    // same stored media cannot become a duplicate legacy gallery item.
    const existing = await prisma.travelPhoto.findMany({
      where: { userId: actor.id, url: { in: photos.map((photo) => photo.url) } },
      select: { id: true, url: true },
    });
    const existingUrls = new Set(existing.map((photo) => photo.url));
    const reused = await Promise.all(
      photos
        .filter((photo) => existingUrls.has(photo.url))
        .map((photo) => {
          const stored = existing.find((item) => item.url === photo.url)!;
          return updateTravelPhotoMetadata(actor.id, stored.id, {
            caption: photo.caption,
            location: photo.location,
            taggedUserIds: photo.taggedUserIds,
          });
        }),
    );
    const unmatched = photos.filter((photo) => !existingUrls.has(photo.url));
    const createdLegacy = unmatched.length
      ? await userService.createTripPhotos(
          actor.id,
          unmatched.map((photo) => ({
            url: photo.url,
            caption: photo.caption,
            location: photo.location,
          })),
        )
      : [];
    // Preserve the compatibility upload route without leaving metadata in the
    // old string-tag shape. The first metadata save upgrades it to TravelPhoto.
    const created = await Promise.all(
      createdLegacy.map((photo) => {
        const source = unmatched.find((item) => item.url === photo.url)!;
        return updateTravelPhotoMetadata(actor.id, photo.id, {
          caption: source.caption,
          location: source.location,
          taggedUserIds: source.taggedUserIds || [],
        });
      }),
    );
    const persisted = [...reused, ...created];
    revalidateTravelViews();
    return persisted;
  });
}

export async function updateTripPhotoAction(
  photoId: string,
  input: {
    caption?: string | null;
    location?: string | null;
    locationData?: {
      city?: string | null;
      country?: string | null;
      countryCode?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
    taggedUserIds?: string[];
  }
) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    // Keep legacy tags in their original record, while using the shared travel
    // metadata service for new TravelPhoto records. This makes the management
    // and travel-profile editors operate on the same persisted photo.
    const legacy = await prisma.tripPhoto.findUnique({
      where: { id: photoId },
      select: { id: true, userId: true },
    });
    const updated = legacy
      ? await userService.updateTripPhoto(actor.id, photoId, input as any)
      : await updateTravelPhotoMetadata(actor.id, photoId, input);
    revalidateTravelViews();
    return updated;
  });
}

export async function deleteTripPhotoAction(photoId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const res = await deleteTravelPhoto(actor.id, photoId);
    revalidateTravelViews();
    return res;
  });
}
