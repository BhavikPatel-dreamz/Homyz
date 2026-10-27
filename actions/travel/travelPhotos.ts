"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import {
  getTravelPhotos,
  getPaginatedTravelPhotos,
  getPhotoDetails,
  getUserTrips,
  createTrip,
  updateTrip,
  deleteTrip,
  setTripCoverPhoto,
  updateTravelPhotoMetadata,
  deleteTravelPhoto,
  togglePhotoLike,
  getLikedPhotos,
  getCountryHighlights,
} from "@/services/travel-photo.service";

function revalidateTravelViews() {
  revalidatePath("/travel-profile");
  revalidatePath("/profile/tab/profile_management/trip_photos");
  revalidatePath("/profile-management");
  revalidatePath("/travelers/[handle]", "page");
}

export async function getTravelPhotosAction(tripId?: string | null) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    return getTravelPhotos(actor.id, { tripId, actorId: actor.id });
  });
}

export async function getPaginatedTravelPhotosAction(opts?: {
  tripId?: string | null;
  country?: string | null;
  limit?: number;
  cursor?: string | null;
}) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    return getPaginatedTravelPhotos({
      userId: actor.id,
      actorId: actor.id,
      tripId: opts?.tripId,
      country: opts?.country,
      limit: opts?.limit,
      cursor: opts?.cursor,
    });
  });
}

export async function getPhotoDetailsAction(photoId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    return getPhotoDetails(photoId, actor?.id);
  });
}

export async function togglePhotoLikeAction(photoId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const res = await togglePhotoLike(actor.id, photoId);
    revalidateTravelViews();
    return res;
  });
}

export async function getLikedPhotosAction(opts?: { limit?: number; cursor?: string | null }) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    return getLikedPhotos(actor.id, opts);
  });
}

export async function getCountryHighlightsAction() {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    return getCountryHighlights(actor.id);
  });
}

export async function getUserTripsAction() {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    return getUserTrips(actor.id);
  });
}

export async function createTravelTripAction(input: {
  title: string;
  destinationId?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const trip = await createTrip(actor.id, input);
    revalidateTravelViews();
    return trip;
  });
}

export async function updateTravelTripAction(
  tripId: string,
  input: {
    title?: string | null;
    destinationId?: string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    coverPhotoId?: string | null;
  }
) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const trip = await updateTrip(actor.id, tripId, input);
    revalidateTravelViews();
    return trip;
  });
}

export async function deleteTravelTripAction(
  tripId: string,
  policy: "UNLINK_PHOTOS" | "DELETE_PHOTOS" = "UNLINK_PHOTOS"
) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const res = await deleteTrip(actor.id, tripId, policy);
    revalidateTravelViews();
    return res;
  });
}

export async function setTripCoverPhotoAction(tripId: string, photoId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const res = await setTripCoverPhoto(actor.id, tripId, photoId);
    revalidateTravelViews();
    return res;
  });
}

export async function updateTravelPhotoMetadataAction(
  photoId: string,
  input: {
    caption?: string | null;
    location?: string | null;
    tripId?: string | null;
    order?: number;
  }
) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const photo = await updateTravelPhotoMetadata(actor.id, photoId, input);
    revalidateTravelViews();
    return photo;
  });
}

export async function deleteTravelPhotoAction(photoId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const res = await deleteTravelPhoto(actor.id, photoId);
    revalidateTravelViews();
    return res;
  });
}
