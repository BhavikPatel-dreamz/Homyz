import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { type AuthUser } from "@/lib/auth/types";
import { validatePublicImageUpload } from "@/lib/media/public-image-validation";
import { savePublicMedia, deleteManagedMediaUrl } from "@/lib/storage/media";
import {
  canAccessTravelPhoto,
  canViewTravelProfile,
} from "@/services/travel-privacy.service";
import path from "node:path";
import { nanoid } from "nanoid";
import {
  getOrCreateDestination,
  normalizeCountry,
} from "@/services/travel-destination.service";
import { isCompletedConfirmedBooking } from "@/lib/booking/booking-status";
import {
  BookingStatus,
  TravelProfileVisibility,
  type Prisma,
} from "@/generated/prisma/client";

import type {
  TravelPhotoDTO,
  TravelTripDTO,
  CountryHighlightDTO,
} from "@/types/travel";

export const MAX_PHOTOS_PER_TRIP = 5;
export const MAX_TRAVEL_PHOTO_CAPTION_LENGTH = 300;
export const MAX_TRAVEL_PHOTO_TAGS = 10;
const SYSTEM_PLACEHOLDER_PHOTO_URLS = new Set([
  "/images/auth-traveler-water.jpg",
]);

/** A saved row is not a gallery item unless it points to actual photo media. */
export function isRenderableTravelPhotoUrl(url: string | null | undefined): boolean {
  const normalized = url?.trim();
  return Boolean(normalized && !SYSTEM_PLACEHOLDER_PHOTO_URLS.has(normalized));
}

const renderablePhotoUrlWhere = {
  notIn: ["", ...SYSTEM_PLACEHOLDER_PHOTO_URLS],
};

export type { TravelPhotoDTO, TravelTripDTO, CountryHighlightDTO };

type PhotoLocationInput = {
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function normalizeCaption(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > MAX_TRAVEL_PHOTO_CAPTION_LENGTH) {
    throw AppError.badRequest(
      `Captions must be ${MAX_TRAVEL_PHOTO_CAPTION_LENGTH} characters or fewer.`,
    );
  }
  return normalized;
}

function normalizeTaggedUserIds(value: string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw AppError.badRequest("People tags must be a list.");
  const ids = [...new Set(value.map((id) => id.trim()).filter(Boolean))];
  if (ids.length > MAX_TRAVEL_PHOTO_TAGS) {
    throw AppError.badRequest(`A photo can tag up to ${MAX_TRAVEL_PHOTO_TAGS} people.`);
  }
  return ids;
}

async function resolvePhotoDestination(
  location: PhotoLocationInput | null | undefined,
): Promise<string | null | undefined> {
  if (location === undefined) return undefined;
  if (location === null) return null;
  const countryCode = location.countryCode?.trim().toUpperCase();
  const countryName = location.country?.trim();
  if (!countryCode || !countryName) return null;
  if (!/^[A-Z]{2}$/.test(countryCode) || countryName.length > 120) {
    throw AppError.badRequest("Invalid selected photo location.");
  }
  const destination = await getOrCreateDestination({
    countryCode,
    countryName,
    cityName: location.city?.trim() || null,
    latitude: typeof location.latitude === "number" ? location.latitude : null,
    longitude: typeof location.longitude === "number" ? location.longitude : null,
  });
  return destination.id;
}

/** Only public, unblocked travel profiles are eligible for a people tag. */
async function assertTaggableUsers(ownerId: string, taggedUserIds: string[]): Promise<void> {
  if (!taggedUserIds.length) return;
  if (taggedUserIds.includes(ownerId)) {
    throw AppError.badRequest("You cannot tag yourself in this photo.");
  }
  const [users, blocks] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { in: taggedUserIds },
        status: "ACTIVE",
        travelProfile: { is: { visibility: "PUBLIC" } },
      },
      select: { id: true },
    }),
    prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerId: ownerId, blockedId: { in: taggedUserIds } },
          { blockerId: { in: taggedUserIds }, blockedId: ownerId },
        ],
      },
      select: { blockerId: true, blockedId: true },
    }),
  ]);
  if (users.length !== taggedUserIds.length || blocks.length > 0) {
    throw AppError.forbidden("One or more selected people cannot be tagged.");
  }
}

export async function searchTaggableTravelUsers(
  ownerId: string,
  query: string,
): Promise<Array<{ id: string; name: string | null; image: string | null; handle: string | null }>> {
  const term = query.trim();
  const users = await prisma.user.findMany({
    where: {
      id: { not: ownerId },
      status: "ACTIVE",
      travelProfile: { is: { visibility: "PUBLIC" } },
      ...(term
        ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { travelProfile: { is: { handle: { contains: term, mode: "insensitive" } } } }] }
        : {}),
    },
    select: {
      id: true,
      name: true,
      image: true,
      travelProfile: { select: { handle: true } },
    },
    take: 20,
  });
  if (!users.length) return [];
  const userIds = users.map((user) => user.id);
  const blocks = await prisma.userBlock.findMany({
    where: {
      OR: [
        { blockerId: ownerId, blockedId: { in: userIds } },
        { blockerId: { in: userIds }, blockedId: ownerId },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });
  const blockedIds = new Set(blocks.map((block) => block.blockerId === ownerId ? block.blockedId : block.blockerId));
  return users
    .filter((user) => !blockedIds.has(user.id))
    .map((user) => ({ id: user.id, name: user.name, image: user.image, handle: user.travelProfile?.handle || null }));
}

/**
 * Legacy TripPhoto records can coexist temporarily with TravelPhoto during the
 * compatibility window. Prefer the new record when both reference the same
 * stored object so a migrated upload is never rendered twice.
 */
function dedupePhotoEntries<T extends { userId: string; url: string }>(
  photos: T[],
): T[] {
  const seen = new Set<string>();
  return photos.filter((photo) => {
    const key = `${photo.userId}:${photo.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Delete media only after neither the new nor legacy photo record references it. */
async function deleteTravelMediaIfUnreferenced(url: string): Promise<void> {
  const [travelReferences, legacyReferences] = await Promise.all([
    prisma.travelPhoto.count({ where: { url } }),
    prisma.tripPhoto.count({ where: { url } }),
  ]);
  if (travelReferences === 0 && legacyReferences === 0) {
    await deleteManagedMediaUrl(url).catch(() => {});
  }
}

export interface UploadPhotoInput {
  file: {
    name: string;
    type: string;
    size: number;
    buffer: Buffer;
  };
  tripId?: string | null;
  tripTitle?: string | null;
  caption?: string | null;
  location?: string | null;
  taggedUserIds?: string[];
  order?: number;
  replacePhotoId?: string | null;
}

/**
 * Extracts a normalized country name from a location string (e.g. "Paris, France" -> "France").
 */
export function extractCountryFromLocation(
  location?: string | null,
): string | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (!trimmed) return null;

  if (trimmed.includes(",")) {
    const parts = trimmed
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last.length >= 2) {
      return last;
    }
  }

  if (trimmed.length >= 3 && trimmed.length <= 40) {
    return trimmed;
  }
  return null;
}

async function findDestinationIdsForCountry(
  country: string,
): Promise<string[]> {
  const normalized = country.trim();
  if (!normalized) return [];

  const destinations = await prisma.destination.findMany({
    where: {
      OR: [
        { countryName: { equals: normalized, mode: "insensitive" } },
        { countryCode: normalized.toUpperCase() },
      ],
    },
    select: { id: true },
  });

  return destinations.map((destination) => destination.id);
}

/**
 * Resolves or creates a minimal trip container for photo association.
 */
export async function getOrCreateTrip(
  userId: string,
  params: { tripId?: string | null; title?: string | null },
): Promise<TravelTripDTO> {
  if (params.tripId) {
    const existing = await prisma.travelTrip.findUnique({
      where: { id: params.tripId },
      include: {
        _count: { select: { photos: true } },
        photos: {
          select: { id: true, url: true, mediumUrl: true },
          take: 1,
        },
      },
    });

    if (!existing) {
      throw AppError.notFound("Trip not found");
    }
    if (existing.userId !== userId) {
      throw AppError.forbidden("You do not have access to this trip");
    }

    let coverUrl: string | null = null;
    if (existing.coverPhotoId) {
      const coverPhoto = await prisma.travelPhoto.findUnique({
        where: { id: existing.coverPhotoId },
        select: { mediumUrl: true, url: true },
      });
      coverUrl = coverPhoto?.mediumUrl || coverPhoto?.url || null;
    } else if (existing.photos.length > 0) {
      coverUrl = existing.photos[0].mediumUrl || existing.photos[0].url || null;
    }

    return {
      id: existing.id,
      userId: existing.userId,
      title: existing.title,
      destinationId: existing.destinationId,
      startDate: existing.startDate,
      endDate: existing.endDate,
      coverPhotoId: existing.coverPhotoId,
      coverUrl,
      status: existing.status,
      photoCount: existing._count.photos,
      remainingCapacity: Math.max(
        0,
        MAX_PHOTOS_PER_TRIP - existing._count.photos,
      ),
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };
  }

  const title = (params.title || "").trim() || "My Travel Adventure";

  // Prevent accidental duplicate trips: look for an existing trip with the same title
  // created recently (within last 5 minutes) for this user
  const recentDuplicate = await prisma.travelTrip.findFirst({
    where: {
      userId,
      title,
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { photos: true, likes: true } },
    },
  });

  if (recentDuplicate) {
    // Return existing recent trip instead of creating a duplicate
    let coverUrl: string | null = null;
    if (recentDuplicate.coverPhotoId) {
      const coverPhoto = await prisma.travelPhoto.findUnique({
        where: { id: recentDuplicate.coverPhotoId },
        select: { mediumUrl: true, url: true },
      });
      coverUrl = coverPhoto?.mediumUrl || coverPhoto?.url || null;
    }
    return {
      id: recentDuplicate.id,
      userId: recentDuplicate.userId,
      title: recentDuplicate.title,
      destinationId: recentDuplicate.destinationId,
      startDate: recentDuplicate.startDate,
      endDate: recentDuplicate.endDate,
      coverPhotoId: recentDuplicate.coverPhotoId,
      coverUrl,
      status: recentDuplicate.status,
      photoCount: recentDuplicate._count.photos,
      remainingCapacity: Math.max(
        0,
        MAX_PHOTOS_PER_TRIP - recentDuplicate._count.photos,
      ),
      createdAt: recentDuplicate.createdAt,
      updatedAt: recentDuplicate.updatedAt,
    };
  }

  const created = await prisma.travelTrip.create({
    data: {
      userId,
      title,
      status: "PUBLISHED",
      visibility: "PUBLIC",
    },
    include: {
      _count: { select: { photos: true } },
    },
  });

  return {
    id: created.id,
    userId: created.userId,
    title: created.title,
    destinationId: created.destinationId,
    startDate: created.startDate,
    endDate: created.endDate,
    coverPhotoId: created.coverPhotoId,
    coverUrl: null,
    status: created.status,
    photoCount: created._count.photos,
    remainingCapacity: MAX_PHOTOS_PER_TRIP,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

/**
 * Asserts that a trip does not exceed the strict 5-photo limit.
 */
export async function assertTripCapacity(
  tripId: string,
  additionalCount: number,
  excludePhotoId?: string | null,
): Promise<{ currentCount: number; remaining: number }> {
  const currentCount = await prisma.travelPhoto.count({
    where: {
      tripId,
      ...(excludePhotoId ? { id: { not: excludePhotoId } } : {}),
    },
  });

  if (currentCount + additionalCount > MAX_PHOTOS_PER_TRIP) {
    throw AppError.badRequest(
      `Trip capacity exceeded. Each trip can contain a maximum of ${MAX_PHOTOS_PER_TRIP} photos. Current: ${currentCount}, attempting to add: ${additionalCount}.`,
    );
  }

  return {
    currentCount,
    remaining: Math.max(
      0,
      MAX_PHOTOS_PER_TRIP - (currentCount + additionalCount),
    ),
  };
}

/**
 * Fetch all trips owned by the user with cover image previews and photo counts.
 */
export async function getUserTrips(userId: string): Promise<TravelTripDTO[]> {
  const trips = await prisma.travelTrip.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { photos: true, likes: true } },
      photos: {
        orderBy: { order: "asc" },
        take: 5,
        include: {
          _count: { select: { likes: true } },
        },
      },
    },
  });

  const destinationIds = [...new Set(trips.flatMap((trip) => trip.destinationId ? [trip.destinationId] : []))];
  const destinations = destinationIds.length
    ? await prisma.destination.findMany({
        where: { id: { in: destinationIds } },
        select: { id: true, countryName: true, countryCode: true },
      })
    : [];
  const destinationsById = new Map(destinations.map((destination) => [destination.id, destination]));

  return trips.map((t) => {
    const visibleTripPhotos = t.photos.filter((photo) =>
      isRenderableTravelPhotoUrl(photo.url),
    );
    let coverUrl: string | null = null;
    if (t.coverPhotoId) {
      const coverPhoto = visibleTripPhotos.find((p) => p.id === t.coverPhotoId);
      coverUrl = coverPhoto?.mediumUrl || coverPhoto?.url || null;
    }
    if (!coverUrl && visibleTripPhotos.length > 0) {
      coverUrl = visibleTripPhotos[0].mediumUrl || visibleTripPhotos[0].url || null;
    }

    const photos: TravelPhotoDTO[] = visibleTripPhotos.map((p) => ({
      id: p.id,
      userId: p.userId,
      tripId: p.tripId,
      tripTitle: t.title,
      url: p.url,
      thumbnailUrl: p.thumbnailUrl || p.url,
      mediumUrl: p.mediumUrl || p.url,
      caption: p.caption,
      location: p.location,
      order: p.order,
      likesCount: p._count.likes,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return {
      id: t.id,
      userId: t.userId,
      title: t.title,
      destinationId: t.destinationId,
      destination: t.destinationId ? destinationsById.get(t.destinationId) ?? null : null,
      startDate: t.startDate,
      endDate: t.endDate,
      coverPhotoId: t.coverPhotoId,
      coverUrl,
      status: t.status,
      visibility: t.visibility,
      likesCount: t._count.likes,
      // Capacity is based on persisted records, not only previewable URLs.
      photoCount: t._count.photos,
      remainingCapacity: Math.max(0, MAX_PHOTOS_PER_TRIP - t._count.photos),
      photos,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  });
}

/**
 * Create a new travel trip.
 */
export async function createTrip(
  userId: string,
  input: {
    title: string;
    destinationId?: string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
  },
): Promise<TravelTripDTO> {
  const title = input.title.trim();
  if (!title) {
    throw AppError.badRequest("Trip title cannot be empty");
  }
  if (input.startDate && input.endDate && new Date(input.endDate) < new Date(input.startDate)) {
    throw AppError.badRequest("End date cannot be before start date");
  }

  const trip = await prisma.travelTrip.create({
    data: {
      userId,
      title,
      destinationId: input.destinationId || null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      status: "PUBLISHED",
      visibility: "PUBLIC",
    },
  });

  return {
    id: trip.id,
    userId: trip.userId,
    title: trip.title,
    destinationId: trip.destinationId,
    startDate: trip.startDate,
    endDate: trip.endDate,
    coverPhotoId: null,
    coverUrl: null,
    status: trip.status,
    photoCount: 0,
    remainingCapacity: MAX_PHOTOS_PER_TRIP,
    photos: [],
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

/**
 * Update trip details (title, dates, destination, coverPhotoId).
 */
export async function updateTrip(
  userId: string,
  tripId: string,
  input: {
    title?: string | null;
    destinationId?: string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    coverPhotoId?: string | null;
  },
): Promise<TravelTripDTO> {
  const trip = await prisma.travelTrip.findUnique({
    where: { id: tripId },
    include: { _count: { select: { photos: true } } },
  });

  if (!trip) throw AppError.notFound("Trip not found");
  if (trip.userId !== userId) throw AppError.forbidden("Access denied");

  if (input.title !== undefined && !input.title?.trim()) {
    throw AppError.badRequest("Trip title cannot be empty");
  }
  const nextStartDate = input.startDate === undefined ? trip.startDate : input.startDate ? new Date(input.startDate) : null;
  const nextEndDate = input.endDate === undefined ? trip.endDate : input.endDate ? new Date(input.endDate) : null;
  if (nextStartDate && nextEndDate && nextEndDate < nextStartDate) {
    throw AppError.badRequest("End date cannot be before start date");
  }

  if (input.coverPhotoId) {
    const photo = await prisma.travelPhoto.findUnique({
      where: { id: input.coverPhotoId },
      select: { tripId: true, userId: true },
    });
    if (!photo || photo.tripId !== tripId || photo.userId !== userId) {
      throw AppError.badRequest("Cover photo must belong to this trip");
    }
  }

  const updated = await prisma.travelTrip.update({
    where: { id: tripId },
    data: {
      ...(input.title !== undefined && {
        title: input.title?.trim() || trip.title,
      }),
      ...(input.destinationId !== undefined && {
        destinationId: input.destinationId,
      }),
      ...(input.startDate !== undefined && {
        startDate: input.startDate ? new Date(input.startDate) : null,
      }),
      ...(input.endDate !== undefined && {
        endDate: input.endDate ? new Date(input.endDate) : null,
      }),
      ...(input.coverPhotoId !== undefined && {
        coverPhotoId: input.coverPhotoId,
      }),
    },
    include: {
      _count: { select: { photos: true } },
    },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    title: updated.title,
    destinationId: updated.destinationId,
    startDate: updated.startDate,
    endDate: updated.endDate,
    coverPhotoId: updated.coverPhotoId,
    status: updated.status,
    photoCount: updated._count.photos,
    remainingCapacity: Math.max(0, MAX_PHOTOS_PER_TRIP - updated._count.photos),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Delete a trip with explicit policy regarding its photos.
 */
export async function deleteTrip(
  userId: string,
  tripId: string,
  policy: "UNLINK_PHOTOS" | "DELETE_PHOTOS" = "UNLINK_PHOTOS",
): Promise<{
  success: boolean;
  unlinkedCount?: number;
  deletedCount?: number;
}> {
  const trip = await prisma.travelTrip.findUnique({
    where: { id: tripId },
    include: { photos: true },
  });

  if (!trip) throw AppError.notFound("Trip not found");
  if (trip.userId !== userId) throw AppError.forbidden("Access denied");

  if (policy === "UNLINK_PHOTOS") {
    // Unlink photos safely
    const unlinked = await prisma.travelPhoto.updateMany({
      where: { tripId },
      data: { tripId: null },
    });
    await prisma.travelTrip.delete({ where: { id: tripId } });
    return { success: true, unlinkedCount: unlinked.count };
  } else {
    // Delete database rows first so shared legacy media remains intact.
    const urls = [...new Set(trip.photos.map((photo) => photo.url))];
    await prisma.$transaction([
      prisma.travelPhoto.deleteMany({ where: { tripId } }),
      prisma.travelTrip.delete({ where: { id: tripId } }),
    ]);
    await Promise.all(urls.map((url) => deleteTravelMediaIfUnreferenced(url)));
    return { success: true, deletedCount: trip.photos.length };
  }
}

/**
 * Set a photo as the trip's cover.
 */
export async function setTripCoverPhoto(
  userId: string,
  tripId: string,
  photoId: string,
): Promise<{ success: boolean; coverPhotoId: string }> {
  const [trip, photo] = await Promise.all([
    prisma.travelTrip.findUnique({ where: { id: tripId } }),
    prisma.travelPhoto.findUnique({ where: { id: photoId } }),
  ]);

  if (!trip) throw AppError.notFound("Trip not found");
  if (trip.userId !== userId) throw AppError.forbidden("Access denied to trip");
  if (!photo) throw AppError.notFound("Photo not found");
  if (photo.userId !== userId || photo.tripId !== tripId) {
    throw AppError.badRequest("Photo does not belong to this trip");
  }

  await prisma.travelTrip.update({
    where: { id: tripId },
    data: { coverPhotoId: photoId },
  });

  return { success: true, coverPhotoId: photoId };
}

/**
 * Upload a single travel photo with strict file validation, magic bytes,
 * transactional 5-photo capacity enforcement, variant generation, and persistence.
 */
export async function uploadTravelPhoto(
  actor: AuthUser,
  input: UploadPhotoInput,
): Promise<TravelPhotoDTO> {
  const {
    file,
    tripId,
    tripTitle,
    caption,
    location,
    taggedUserIds: requestedTaggedUserIds,
    order = 0,
    replacePhotoId,
  } = input;
  const normalizedCaption = normalizeCaption(caption);
  const taggedUserIds = normalizeTaggedUserIds(requestedTaggedUserIds);
  if (taggedUserIds) await assertTaggableUsers(actor.id, taggedUserIds);

  // 1. Validate file format, magic bytes, and size
  const validation = validatePublicImageUpload({
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    buffer: file.buffer,
  });

  if (validation) {
    throw AppError.badRequest(validation.message);
  }

  // 2. Resolve or create trip association if provided
  let resolvedTripId: string | null = null;
  let resolvedTripTitle: string | null = null;
  let resolvedDestinationId: string | null = null;

  if (tripId || tripTitle) {
    const trip = await getOrCreateTrip(actor.id, {
      tripId: tripId || null,
      title: tripTitle || null,
    });
    resolvedTripId = trip.id;
    resolvedTripTitle = trip.title;
    resolvedDestinationId = trip.destinationId;

    // Check 5-photo limit inside transaction logic
    await assertTripCapacity(trip.id, replacePhotoId ? 0 : 1, replacePhotoId);
  }

  // 3. Handle Replacement if replacePhotoId is given
  let existingPhotoToReplace: { id: string; url: string } | null = null;
  if (replacePhotoId) {
    const existing = await prisma.travelPhoto.findUnique({
      where: { id: replacePhotoId },
    });
    if (!existing) {
      // Check legacy TripPhoto
      const legacy = await prisma.tripPhoto.findUnique({
        where: { id: replacePhotoId },
      });
      if (!legacy) throw AppError.notFound("Photo to replace not found");
      if (legacy.userId !== actor.id) throw AppError.forbidden("Access denied");
      existingPhotoToReplace = { id: legacy.id, url: legacy.url };
    } else {
      if (existing.userId !== actor.id)
        throw AppError.forbidden("Access denied");
      existingPhotoToReplace = { id: existing.id, url: existing.url };
      if (!resolvedTripId && existing.tripId) {
        resolvedTripId = existing.tripId;
      }
    }
  }

  // 4. Save to secure media storage
  const extMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
  };
  const ext =
    extMap[file.type] || path.extname(file.name).toLowerCase() || ".jpg";
  const uniqueName = `travel_photo_${Date.now()}_${nanoid(8)}${ext}`;

  const saved = await savePublicMedia({
    kind: "travel-photos",
    fileName: uniqueName,
    body: file.buffer,
    contentType: file.type,
  });

  // Responsive variant identifiers
  const thumbnailUrl = `${saved.url}?w=320&q=75`;
  const mediumUrl = `${saved.url}?w=768&q=80`;

  // 5. Database Persistence with capacity re-verification in transaction
  const result = await prisma.$transaction(async (tx) => {
    if (resolvedTripId && !replacePhotoId) {
      const activeCount = await tx.travelPhoto.count({
        where: { tripId: resolvedTripId },
      });
      if (activeCount >= MAX_PHOTOS_PER_TRIP) {
        throw AppError.badRequest(
          `Cannot add photo: trip already contains maximum ${MAX_PHOTOS_PER_TRIP} photos.`,
        );
      }
    }

    if (replacePhotoId) {
      // Check if updating an existing TravelPhoto
      const travelPhoto = await tx.travelPhoto.findUnique({
        where: { id: replacePhotoId },
      });
      if (travelPhoto) {
        return tx.travelPhoto.update({
          where: { id: replacePhotoId },
          data: {
            url: saved.url,
            thumbnailUrl,
            mediumUrl,
            ...(normalizedCaption !== undefined && {
              caption: normalizedCaption,
            }),
            ...(location !== undefined && {
              location: location ? location.trim() : null,
            }),
            ...(resolvedTripId && { tripId: resolvedTripId }),
            ...(resolvedDestinationId && {
              destinationId: resolvedDestinationId,
            }),
            ...(taggedUserIds !== undefined && {
              personTags: {
                deleteMany: {},
                create: taggedUserIds.map((taggedUserId) => ({ taggedUserId })),
              },
            }),
          },
          include: { trip: true },
        });
      }

      // Or converting a legacy TripPhoto into a TravelPhoto
      const legacyPhoto = await tx.tripPhoto.findUnique({
        where: { id: replacePhotoId },
      });
      if (legacyPhoto) {
        await tx.tripPhoto.delete({ where: { id: replacePhotoId } });
        return tx.travelPhoto.create({
          data: {
            userId: actor.id,
            tripId: resolvedTripId,
            destinationId: resolvedDestinationId,
            url: saved.url,
            thumbnailUrl,
            mediumUrl,
            caption:
              normalizedCaption !== undefined
                ? normalizedCaption
                : legacyPhoto.caption,
            location:
              location !== undefined
                ? location
                  ? location.trim()
                  : null
                : legacyPhoto.location,
            order,
            ...(taggedUserIds !== undefined && {
              personTags: { create: taggedUserIds.map((taggedUserId) => ({ taggedUserId })) },
            }),
          },
          include: { trip: true },
        });
      }
    }

    // Standard new TravelPhoto creation
    return tx.travelPhoto.create({
      data: {
        userId: actor.id,
        tripId: resolvedTripId,
        destinationId: resolvedDestinationId,
        url: saved.url,
        thumbnailUrl,
        mediumUrl,
        caption: normalizedCaption || null,
        location: location ? location.trim() : null,
        order,
        ...(taggedUserIds !== undefined && {
          personTags: { create: taggedUserIds.map((taggedUserId) => ({ taggedUserId })) },
        }),
      },
      include: { trip: true },
    });
  });

  // 6. Asynchronously clean up old media file if replacement succeeded
  if (existingPhotoToReplace) {
    deleteTravelMediaIfUnreferenced(existingPhotoToReplace.url).catch(() => {});
  }

  return {
    id: result.id,
    userId: result.userId,
    tripId: result.tripId,
    tripTitle: result.trip?.title || resolvedTripTitle || null,
    url: result.url,
    thumbnailUrl: result.thumbnailUrl,
    mediumUrl: result.mediumUrl,
    caption: result.caption,
    location: result.location,
    order: result.order,
    likesCount: 0,
    isLiked: false,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

/**
 * Retrieve paginated travel photos with cursor pagination, country filter,
 * trip filter, likes counts, and actor like status.
 */
export async function getPaginatedTravelPhotos(opts: {
  userId: string;
  actorId?: string | null;
  tripId?: string | null;
  country?: string | null;
  limit?: number;
  cursor?: string | null;
}): Promise<{
  items: TravelPhotoDTO[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);

  const whereClause: Record<string, unknown> = {
    userId: opts.userId,
    url: renderablePhotoUrlWhere,
    ...(opts.tripId ? { tripId: opts.tripId } : {}),
  };

  if (opts.actorId !== opts.userId) {
    const profileAccess = await canViewTravelProfile(opts.actorId, opts.userId);
    if (!profileAccess.canView) {
      throw AppError.forbidden("Access to this travel profile is forbidden.");
    }

    const allowedVisibilities = profileAccess.isFollowing
      ? ["PUBLIC", "FOLLOWERS_ONLY"]
      : ["PUBLIC"];
    whereClause.AND = [
      { visibility: { in: allowedVisibilities } },
      {
        OR: [
          { tripId: null },
          { trip: { is: { visibility: { in: allowedVisibilities } } } },
        ],
      },
    ];
  }

  if (opts.country) {
    const destinationIds = await findDestinationIdsForCountry(opts.country);
    const locationFilter = {
      location: {
        contains: opts.country,
        mode: "insensitive" as const,
      },
    };
    whereClause.OR = destinationIds.length
      ? [
          locationFilter,
          { destinationId: { in: destinationIds } },
          { trip: { is: { destinationId: { in: destinationIds } } } },
        ]
      : [locationFilter];
  }

  const [rawPhotos, totalCount] = await Promise.all([
    prisma.travelPhoto.findMany({
      where: whereClause,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: {
        trip: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, image: true } },
        personTags: {
          include: { taggedUser: { select: { id: true, name: true, image: true, travelProfile: { select: { handle: true, visibility: true } } } } },
        },
        _count: { select: { likes: true, comments: true } },
        likes: opts.actorId
          ? {
              where: { actorId: opts.actorId },
              select: { actorId: true },
            }
          : false,
      },
    }),
    prisma.travelPhoto.count({ where: whereClause }),
  ]);

  let nextCursor: string | null = null;
  let hasMore = false;
  const photos = [...rawPhotos];

  if (photos.length > limit) {
    hasMore = true;
    photos.pop();
    // Prisma's cursor is exclusive below, so continue after the final item we
    // returned. Using the extra record here skipped one photo on every page.
    nextCursor = photos.at(-1)?.id ?? null;
  }

  const items: TravelPhotoDTO[] = photos.map((p) => ({
    id: p.id,
    userId: p.userId,
    tripId: p.tripId,
    tripTitle: p.trip?.title || null,
    url: p.url,
    thumbnailUrl: p.thumbnailUrl || p.url,
    mediumUrl: p.mediumUrl || p.url,
    caption: p.caption,
    location: p.location,
    destinationId: p.destinationId,
    taggedPeople: p.personTags
      .filter((tag) => tag.taggedUser.travelProfile?.visibility === "PUBLIC")
      .map((tag) => ({
        id: tag.taggedUser.id,
        name: tag.taggedUser.name,
        image: tag.taggedUser.image,
        handle: tag.taggedUser.travelProfile?.handle || null,
      })),
    order: p.order,
    likesCount: p._count.likes,
    commentsCount: p._count.comments,
    isLiked: Array.isArray(p.likes) && p.likes.length > 0,
    visibility: p.visibility,
    author: p.user,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    isLegacy: false,
  }));

  // If no trip or country filter, also seamlessly append unassociated legacy photos on first page
  if (
    !opts.cursor &&
    !opts.tripId &&
    !opts.country &&
    opts.actorId === opts.userId
  ) {
    const legacy = await prisma.tripPhoto.findMany({
      where: { userId: opts.userId, url: renderablePhotoUrlWhere },
      orderBy: { createdAt: "desc" },
    });

    const legacyDtos: TravelPhotoDTO[] = legacy.map((lp, idx) => ({
      id: lp.id,
      userId: lp.userId,
      tripId: null,
      tripTitle: null,
      url: lp.url,
      thumbnailUrl: lp.url,
      mediumUrl: lp.url,
      caption: lp.caption,
      location: lp.location,
      tags: lp.tags,
      order: items.length + idx,
      likesCount: 0,
      isLiked: false,
      createdAt: lp.createdAt,
      updatedAt: lp.updatedAt,
      isLegacy: true,
    }));

    const mergedItems = dedupePhotoEntries([...items, ...legacyDtos]);
    return {
      items: mergedItems,
      nextCursor,
      hasMore,
      // `totalCount` includes only TravelPhoto. The current page can include
      // legacy compatibility rows, so only count unique additions here.
      totalCount: totalCount + Math.max(0, mergedItems.length - items.length),
    };
  }

  return { items, nextCursor, hasMore, totalCount };
}

/**
 * Retrieve all travel photos for a user (convenience backward compatible method).
 */
export async function getTravelPhotos(
  userId: string,
  opts?: {
    tripId?: string | null;
    includeLegacy?: boolean;
    actorId?: string | null;
  },
): Promise<TravelPhotoDTO[]> {
  const res = await getPaginatedTravelPhotos({
    userId,
    tripId: opts?.tripId,
    actorId: opts?.actorId,
    limit: 50,
  });
  return res.items;
}

/**
 * Retrieve single photo details for lightbox modal navigation.
 */
export async function getPhotoDetails(
  photoId: string,
  actorId?: string | null,
): Promise<TravelPhotoDTO> {
  const photo = await prisma.travelPhoto.findUnique({
    where: { id: photoId },
    include: {
      trip: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, image: true } },
      personTags: {
        include: { taggedUser: { select: { id: true, name: true, image: true, travelProfile: { select: { handle: true, visibility: true } } } } },
      },
      _count: { select: { likes: true, comments: true } },
      likes: actorId
        ? {
            where: { actorId },
            select: { actorId: true },
          }
        : false,
    },
  });

  if (!photo) {
    // Check legacy photo
    const legacy = await prisma.tripPhoto.findUnique({
      where: { id: photoId },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    if (!legacy) throw AppError.notFound("Travel photo not found");
    if (!isRenderableTravelPhotoUrl(legacy.url)) {
      throw AppError.notFound("Travel photo is not available.");
    }
    const legacyAccess = await canViewTravelProfile(actorId, legacy.userId);
    if (!legacyAccess.canView)
      throw AppError.forbidden("Access to this travel photo is forbidden.");

    return {
      id: legacy.id,
      userId: legacy.userId,
      tripId: null,
      tripTitle: null,
      url: legacy.url,
      thumbnailUrl: legacy.url,
      mediumUrl: legacy.url,
      caption: legacy.caption,
      location: legacy.location,
      order: 0,
      likesCount: 0,
      isLiked: false,
      author: legacy.user,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      isLegacy: true,
    };
  }

  if (!isRenderableTravelPhotoUrl(photo.url)) {
    throw AppError.notFound("Travel photo is not available.");
  }

  const access = await canAccessTravelPhoto(actorId, photo.id);
  if (!access.canAccess) {
    throw AppError.forbidden("Access to this travel photo is forbidden.");
  }

  // Find previous and next photo IDs for lightbox navigation
  const [prevPhoto, nextPhoto] = await Promise.all([
    prisma.travelPhoto.findFirst({
      where: {
        userId: photo.userId,
        createdAt: { gt: photo.createdAt },
        ...(photo.tripId ? { tripId: photo.tripId } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    prisma.travelPhoto.findFirst({
      where: {
        userId: photo.userId,
        createdAt: { lt: photo.createdAt },
        ...(photo.tripId ? { tripId: photo.tripId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);

  return {
    id: photo.id,
    userId: photo.userId,
    tripId: photo.tripId,
    tripTitle: photo.trip?.title || null,
    url: photo.url,
    thumbnailUrl: photo.thumbnailUrl || photo.url,
    mediumUrl: photo.mediumUrl || photo.url,
    caption: photo.caption,
    location: photo.location,
    destinationId: photo.destinationId,
    taggedPeople: photo.personTags
      .filter((tag) => tag.taggedUser.travelProfile?.visibility === "PUBLIC")
      .map((tag) => ({
        id: tag.taggedUser.id,
        name: tag.taggedUser.name,
        image: tag.taggedUser.image,
        handle: tag.taggedUser.travelProfile?.handle || null,
      })),
    order: photo.order,
    likesCount: photo._count.likes,
    commentsCount: photo._count.comments,
    isLiked: Array.isArray(photo.likes) && photo.likes.length > 0,
    visibility: photo.visibility,
    author: photo.user,
    prevPhotoId: prevPhoto?.id || null,
    nextPhotoId: nextPhoto?.id || null,
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
    isLegacy: false,
  };
}

/**
 * Toggle like on a travel photo.
 */
export async function togglePhotoLike(
  actorId: string,
  photoId: string,
): Promise<{ liked: boolean; count: number }> {
  const photo = await prisma.travelPhoto.findUnique({
    where: { id: photoId },
    select: { id: true, userId: true },
  });

  if (!photo) {
    throw AppError.notFound("Travel photo not found");
  }

  const access = await canAccessTravelPhoto(actorId, photoId);
  if (!access.canAccess) {
    throw AppError.forbidden("You cannot like a photo you cannot access.");
  }

  // Social rule: user cannot like their own travel photo
  if (photo.userId === actorId) {
    throw AppError.badRequest("You cannot like your own travel photo.");
  }

  const existing = await prisma.travelPhotoLike.findUnique({
    where: {
      actorId_photoId: {
        actorId,
        photoId,
      },
    },
  });

  try {
    if (existing) {
      await prisma.travelPhotoLike.delete({
        where: {
          actorId_photoId: {
            actorId,
            photoId,
          },
        },
      });
    } else {
      await prisma.travelPhotoLike.create({
        data: {
          id: nanoid(),
          actorId,
          userId: actorId,
          photoId,
        },
      });
    }
  } catch (error: unknown) {
    // Two rapid clicks can race on the unique relation. Preserve the single
    // persisted relation and return its authoritative state instead of 500.
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "P2002" || error.code === "P2025")
    )) {
      throw error;
    }
  }

  const count = await prisma.travelPhotoLike.count({
    where: { photoId },
  });

  const persisted = await prisma.travelPhotoLike.findUnique({
    where: { actorId_photoId: { actorId, photoId } },
    select: { id: true },
  });

  return { liked: Boolean(persisted), count };
}

/**
 * Get like status for a photo.
 */
export async function getPhotoLikeStatus(
  actorId: string | null | undefined,
  photoId: string,
): Promise<{ liked: boolean; count: number }> {
  const access = await canAccessTravelPhoto(actorId, photoId);
  if (!access.canAccess) {
    throw AppError.forbidden("You cannot access this travel photo.");
  }

  const [count, liked] = await Promise.all([
    prisma.travelPhotoLike.count({ where: { photoId } }),
    actorId
      ? prisma.travelPhotoLike
          .findUnique({
            where: {
              actorId_photoId: {
                actorId,
                photoId,
              },
            },
          })
          .then(Boolean)
      : Promise.resolve(false),
  ]);

  return { liked, count };
}

/**
 * Get a traveler's photos that have received at least one like for the
 * profile Likes tab. This intentionally uses the same "likes received"
 * direction as the profile statistic, rather than returning photos the
 * traveler has liked elsewhere.
 */
export async function getLikedPhotos(
  actorId: string,
  opts?: { limit?: number; cursor?: string | null },
): Promise<{
  items: TravelPhotoDTO[];
  nextCursor: string | null;
  totalCount: number;
}> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);

  const where = {
    userId: actorId,
    url: renderablePhotoUrlWhere,
    likes: { some: {} },
  };

  const [photos, totalCount] = await Promise.all([
    prisma.travelPhoto.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: {
        trip: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, image: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    prisma.travelPhoto.count({ where }),
  ]);

  let nextCursor: string | null = null;
  const items = [...photos];
  if (items.length > limit) {
    items.pop();
    nextCursor = items.at(-1)?.id ?? null;
  }

  return {
    items: items.map((photo) => ({
      id: photo.id,
      userId: photo.userId,
      tripId: photo.tripId,
      tripTitle: photo.trip?.title || null,
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl || photo.url,
      mediumUrl: photo.mediumUrl || photo.url,
      caption: photo.caption,
      location: photo.location,
      order: photo.order,
      likesCount: photo._count.likes,
      commentsCount: photo._count.comments,
      isLiked: false,
      visibility: photo.visibility,
      author: photo.user,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt,
      isLegacy: false,
    })),
    nextCursor,
    totalCount,
  };
}

/**
 * Aggregate Country Highlights from stored travel memories.
 */
export async function getCountryHighlights(
  userId: string,
  options: { actorId?: string | null } = {},
): Promise<CountryHighlightDTO[]> {
  const isOwner = options.actorId === userId;
  const access = isOwner
    ? { isFollowing: true }
    : await canViewTravelProfile(options.actorId, userId);
  const visibleToViewer: TravelProfileVisibility[] | undefined = isOwner
    ? undefined
    : access.isFollowing
      ? [TravelProfileVisibility.PUBLIC, TravelProfileVisibility.FOLLOWERS_ONLY]
      : [TravelProfileVisibility.PUBLIC];
  const tripVisibilityWhere: Prisma.EnumTravelProfileVisibilityFilter<"TravelTrip"> | undefined = isOwner
    ? undefined
    : access.isFollowing
      ? { in: [TravelProfileVisibility.PUBLIC, TravelProfileVisibility.FOLLOWERS_ONLY] }
      : { equals: TravelProfileVisibility.PUBLIC };
  const viewerVisibilityWhere: Prisma.TravelPhotoWhereInput = {
    ...(visibleToViewer ? { visibility: { in: visibleToViewer } } : {}),
    ...(tripVisibilityWhere
      ? {
          AND: [
            {
              OR: [
                { trip: { is: null } },
                { trip: { is: { visibility: tripVisibilityWhere } } },
              ],
            },
          ],
        }
      : {}),
  };

  const photos = await prisma.travelPhoto.findMany({
    where: {
      userId,
      url: renderablePhotoUrlWhere,
      ...viewerVisibilityWhere,
      OR: [
        { location: { not: null } },
        { destinationId: { not: null } },
        { trip: { is: { destinationId: { not: null } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      thumbnailUrl: true,
      mediumUrl: true,
      location: true,
      destinationId: true,
      trip: { select: { destinationId: true } },
    },
  });

  // Created trips and verified stays are useful owner-only history, but neither
  // may reveal a country to a profile viewer without a visible photo.
  const [trips, verifiedUserDests, confirmedBookings] = await Promise.all([
    isOwner
      ? prisma.travelTrip.findMany({
          where: { userId, destinationId: { not: null } },
          select: { destinationId: true },
        })
      : Promise.resolve([]),
    isOwner
      ? prisma.userDestination.findMany({
          where: { userId, verificationStatus: "VERIFIED" },
          include: { destination: true },
        })
      : Promise.resolve([]),
    // Do not require a separate reconciliation write before a completed stay
    // appears on its owner's profile. This also includes bookings created
    // before UserDestination records were introduced.
    isOwner
      ? prisma.booking.findMany({
          where: { userId, status: BookingStatus.CONFIRMED },
          select: {
            status: true,
            startDate: true,
            endDate: true,
            propertyTimeZone: true,
            checkOutTime: true,
            listing: { select: { country: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const completedBookingCountries = confirmedBookings.flatMap((booking) => {
    if (
      !isCompletedConfirmedBooking({
        dbStatus: booking.status,
        startDate: booking.startDate,
        endDate: booking.endDate,
        checkOutTime: booking.checkOutTime,
        propertyTimeZone: booking.propertyTimeZone,
      })
    ) {
      return [];
    }

    const country = normalizeCountry(booking.listing.country);
    return country ? [country] : [];
  });

  const destinationIds = [
    ...new Set(
      photos
        .map((photo) => photo.destinationId || photo.trip?.destinationId)
        .concat(trips.map((trip) => trip.destinationId))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const destinations = destinationIds.length
    ? await prisma.destination.findMany({
        where: { id: { in: destinationIds } },
        select: { id: true, countryName: true, countryCode: true },
      })
    : [];
  const destinationById = new Map(
    destinations.map((destination) => [destination.id, destination]),
  );
  const countryMap = new Map<
    string,
    {
      country: string;
      countryCode: string | null;
      photoCount: number;
      coverUrl: string | null;
      sampleLocation?: string;
    }
  >();

  for (const photo of photos) {
    const destinationId = photo.destinationId || photo.trip?.destinationId;
    const normalizedDestination = destinationId
      ? destinationById.get(destinationId)
      : null;
    const country =
      normalizedDestination?.countryName ||
      extractCountryFromLocation(photo.location);
    if (!country) continue;
    const normalizedKey = country.trim().toLocaleLowerCase();
    if (!countryMap.has(normalizedKey)) {
      countryMap.set(normalizedKey, {
        country,
        countryCode: normalizedDestination?.countryCode || null,
        photoCount: 1,
        coverUrl: photo.mediumUrl || photo.url,
        sampleLocation: photo.location || undefined,
      });
    } else {
      const existing = countryMap.get(normalizedKey)!;
      existing.photoCount += 1;
    }
  }

  // A created trip is real user-owned travel data even when it has no photo.
  // Catalog destinations alone never reach this branch.
  for (const trip of trips) {
    if (!trip.destinationId) continue;
    const destination = destinationById.get(trip.destinationId);
    if (!destination) continue;
    const key = destination.countryName.toLocaleLowerCase();
    if (!countryMap.has(key)) {
      countryMap.set(key, {
        country: destination.countryName,
        countryCode: destination.countryCode,
        photoCount: 0,
        coverUrl: null,
        sampleLocation: destination.countryName,
      });
    }
  }

  const verifiedCountryNames = new Set<string>();
  const verifiedCountryCodes = new Set<string>();

  for (const ud of verifiedUserDests) {
    if (!ud.destination) continue;
    if (!ud.destination.cityName) {
      verifiedCountryNames.add(ud.destination.countryName.toLowerCase());
      verifiedCountryCodes.add(ud.destination.countryCode.toUpperCase());
    }
  }

  for (const country of completedBookingCountries) {
    verifiedCountryNames.add(country.countryName.toLowerCase());
    verifiedCountryCodes.add(country.countryCode.toUpperCase());
  }

  // Also include verified countries if they are not already in memories
  for (const ud of verifiedUserDests) {
    if (!ud.destination || ud.destination.cityName) continue;
    const name = ud.destination.countryName;
    const normalizedKey = name.toLocaleLowerCase();
    if (!countryMap.has(normalizedKey)) {
      countryMap.set(normalizedKey, {
        country: name,
        countryCode: ud.destination.countryCode,
        photoCount: 0,
        // A verified stay is real data even when the guest has not uploaded a
        // memory. Leave the cover empty so the UI can show a neutral place
        // marker instead of a misleading stock image.
        coverUrl: null,
        sampleLocation: name,
      });
    }
  }

  // Legacy completed stays can exist before their UserDestination projection
  // has been reconciled. Project those stays into the owner's carousel at
  // read time, without mutating booking or destination history.
  for (const country of completedBookingCountries) {
    const normalizedKey = country.countryName.toLocaleLowerCase();
    if (!countryMap.has(normalizedKey)) {
      countryMap.set(normalizedKey, {
        country: country.countryName,
        countryCode: country.countryCode,
        photoCount: 0,
        coverUrl: null,
        sampleLocation: country.countryName,
      });
    }
  }

  return Array.from(countryMap.values()).map((data) => ({
    country: data.country,
    countryCode: data.countryCode,
    photoCount: data.photoCount,
    coverUrl: data.coverUrl,
    sampleLocation: data.sampleLocation,
    isVerified:
      verifiedCountryNames.has(data.country.toLowerCase()) ||
      Boolean(
        data.countryCode &&
        verifiedCountryCodes.has(data.countryCode.toUpperCase()),
      ),
  }));
}

/**
 * Update photo metadata (caption, location, order, trip association).
 */
export async function updateTravelPhotoMetadata(
  userId: string,
  photoId: string,
  input: {
    caption?: string | null;
    location?: string | null;
    locationData?: PhotoLocationInput | null;
    taggedUserIds?: string[];
    tripId?: string | null;
    order?: number;
  },
): Promise<TravelPhotoDTO> {
  const caption = input.caption === undefined ? undefined : normalizeCaption(input.caption);
  const taggedUserIds = normalizeTaggedUserIds(input.taggedUserIds);
  const destinationId = await resolvePhotoDestination(input.locationData);
  const photo = await prisma.travelPhoto.findUnique({
    where: { id: photoId },
    include: { trip: true },
  });

  if (!photo) {
    // Check legacy photo
    const legacy = await prisma.tripPhoto.findUnique({
      where: { id: photoId },
    });
    if (!legacy) throw AppError.notFound("Photo not found");
    if (legacy.userId !== userId) throw AppError.forbidden("Access denied");

    // Tagging or attaching a destination upgrades the legacy row to the
    // current model so people tags are enforced with a database relation.
    if (input.tripId || taggedUserIds !== undefined || destinationId !== undefined) {
      if (input.tripId) await assertTripCapacity(input.tripId, 1);
      if (taggedUserIds) await assertTaggableUsers(userId, taggedUserIds);
      const converted = await prisma.$transaction(async (tx) => {
        await tx.tripPhoto.delete({ where: { id: photoId } });
        return tx.travelPhoto.create({
          data: {
            userId,
            tripId: input.tripId || null,
            ...(destinationId !== undefined && { destinationId }),
            url: legacy.url,
            thumbnailUrl: legacy.url,
            mediumUrl: legacy.url,
            caption:
              caption !== undefined
                ? caption
                : legacy.caption,
            location:
              input.location !== undefined
                ? input.location
                  ? input.location.trim()
                  : null
                : legacy.location,
            order: input.order ?? 0,
            ...(taggedUserIds !== undefined && {
              personTags: { create: taggedUserIds.map((taggedUserId) => ({ taggedUserId })) },
            }),
          },
          include: {
            trip: true,
            personTags: {
              include: {
                taggedUser: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                    travelProfile: {
                      select: { handle: true, visibility: true },
                    },
                  },
                },
              },
            },
          },
        });
      });

      return {
        id: converted.id,
        userId: converted.userId,
        tripId: converted.tripId,
        tripTitle: converted.trip?.title || null,
        url: converted.url,
        thumbnailUrl: converted.thumbnailUrl,
        mediumUrl: converted.mediumUrl,
        caption: converted.caption,
        location: converted.location,
        destinationId: converted.destinationId,
        taggedPeople: converted.personTags
          .filter((tag) => tag.taggedUser.travelProfile?.visibility === "PUBLIC")
          .map((tag) => ({ id: tag.taggedUser.id, name: tag.taggedUser.name, image: tag.taggedUser.image, handle: tag.taggedUser.travelProfile?.handle || null })),
        order: converted.order,
        createdAt: converted.createdAt,
        updatedAt: converted.updatedAt,
      };
    }

    // Otherwise update legacy record in-place
    const updatedLegacy = await prisma.tripPhoto.update({
      where: { id: photoId },
      data: {
        ...(input.caption !== undefined && {
          caption,
        }),
        ...(input.location !== undefined && {
          location: input.location ? input.location.trim() : null,
        }),
      },
    });

    return {
      id: updatedLegacy.id,
      userId: updatedLegacy.userId,
      tripId: null,
      url: updatedLegacy.url,
      thumbnailUrl: updatedLegacy.url,
      mediumUrl: updatedLegacy.url,
      caption: updatedLegacy.caption,
      location: updatedLegacy.location,
      tags: updatedLegacy.tags,
      order: 0,
      createdAt: updatedLegacy.createdAt,
      updatedAt: updatedLegacy.updatedAt,
      isLegacy: true,
    };
  }

  if (photo.userId !== userId) {
    throw AppError.forbidden("You do not have permission to modify this photo");
  }
  if (taggedUserIds) await assertTaggableUsers(userId, taggedUserIds);

  // If changing trip, assert capacity on the target trip
  if (input.tripId !== undefined && input.tripId !== photo.tripId) {
    if (input.tripId !== null) {
      await assertTripCapacity(input.tripId, 1);
    }
  }

  const updated = await prisma.travelPhoto.update({
    where: { id: photoId },
    data: {
      ...(input.caption !== undefined && {
        caption,
      }),
      ...(input.location !== undefined && {
        location: input.location ? input.location.trim() : null,
      }),
      ...(destinationId !== undefined && { destinationId }),
      ...(input.tripId !== undefined && { tripId: input.tripId }),
      ...(input.order !== undefined && { order: input.order }),
      ...(taggedUserIds !== undefined && {
        personTags: {
          deleteMany: {},
          create: taggedUserIds.map((taggedUserId) => ({ taggedUserId })),
        },
      }),
    },
    include: {
      trip: true,
      personTags: {
        include: {
          taggedUser: {
            select: {
              id: true,
              name: true,
              image: true,
              travelProfile: {
                select: { handle: true, visibility: true },
              },
            },
          },
        },
      },
    },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    tripId: updated.tripId,
    tripTitle: updated.trip?.title || null,
    url: updated.url,
    thumbnailUrl: updated.thumbnailUrl,
    mediumUrl: updated.mediumUrl,
    caption: updated.caption,
    location: updated.location,
    destinationId: updated.destinationId,
    taggedPeople: updated.personTags
      .filter((tag) => tag.taggedUser.travelProfile?.visibility === "PUBLIC")
      .map((tag) => ({ id: tag.taggedUser.id, name: tag.taggedUser.name, image: tag.taggedUser.image, handle: tag.taggedUser.travelProfile?.handle || null })),
    order: updated.order,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Delete a photo and remove its underlying stored media file safely.
 */
export async function deleteTravelPhoto(
  userId: string,
  photoId: string,
): Promise<{ success: boolean; deletedId: string }> {
  const photo = await prisma.travelPhoto.findUnique({ where: { id: photoId } });

  if (photo) {
    if (photo.userId !== userId) {
      throw AppError.forbidden(
        "You do not have permission to delete this photo",
      );
    }
    // A removed cover must not leave a dangling photo id on its trip. The
    // gallery count and the trip preview are then refreshed from the same
    // transaction by the management screen.
    await prisma.$transaction([
      prisma.travelTrip.updateMany({
        where: { userId, coverPhotoId: photoId },
        data: { coverPhotoId: null },
      }),
      prisma.travelPhoto.delete({ where: { id: photoId } }),
    ]);
    await deleteTravelMediaIfUnreferenced(photo.url);
    return { success: true, deletedId: photoId };
  }

  // Check legacy photo
  const legacy = await prisma.tripPhoto.findUnique({ where: { id: photoId } });
  if (!legacy) {
    throw AppError.notFound("Photo not found");
  }
  if (legacy.userId !== userId) {
    throw AppError.forbidden("You do not have permission to delete this photo");
  }
  await prisma.tripPhoto.delete({ where: { id: photoId } });
  await deleteTravelMediaIfUnreferenced(legacy.url);
  return { success: true, deletedId: photoId };
}
