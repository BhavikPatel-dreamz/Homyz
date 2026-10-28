import { AppError } from "@/lib/api/errors";
import { isCompletedConfirmedBooking } from "@/lib/booking/booking-status";
import { prisma } from "@/lib/db/prisma";
import { Prisma, ReviewStatus, TravelProfileVisibility } from "@/generated/prisma/client";
import type { CountryHighlightDTO, PublicTravelPhotoDTO, PublicTravelProfileDTO, PublicTravelStampDTO } from "@/types/travel";
import { getTravelerDestinationStats } from "./travel-destination.service";
import { extractCountryFromLocation, getCountryHighlights, isRenderableTravelPhotoUrl } from "./travel-photo.service";
import { canViewTravelProfile, getTravelFollowCounts } from "./travel-privacy.service";
import { normalizeHandle } from "./travel-profile.service";
import { getTravelerStamps } from "./travel-stamp.service";

export type { PublicTravelPhotoDTO, PublicTravelProfileDTO, PublicTravelStampDTO } from "@/types/travel";
type PublicTravelProfileRecord = Prisma.TravelProfileGetPayload<{
  include: { user: { select: { id: true; name: true; image: true } } };
}>;

export const PUBLIC_PROFILE_ID_REGEX = /^trv_[a-f0-9]{16}$/;

export function normalizePublicProfileId(raw: string | null | undefined): string | null {
  const value = raw?.trim().toLowerCase() || "";
  return PUBLIC_PROFILE_ID_REGEX.test(value) ? value : null;
}

export function getCanonicalProfileUrl(publicProfileId: string): string {
  const normalized = normalizePublicProfileId(publicProfileId);
  if (!normalized) throw AppError.badRequest("Invalid public profile ID");
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://homyz.co";
  return `${origin.replace(/\/+$/, "")}/travelers/${encodeURIComponent(normalized)}`;
}

async function getPublicTravelProfile(
  profile: PublicTravelProfileRecord | null,
  viewerId?: string | null,
): Promise<PublicTravelProfileDTO> {
  if (!profile) throw AppError.notFound("Traveler profile not found");
  const fallbackHandle = profile.handle || "traveler";

  const ownerId = profile.userId;
  const access = await canViewTravelProfile(viewerId, ownerId);
  const [completedStays, profileLikes, photoLikes, tripLikes, reviews, destinationStats, followCounts] = await Promise.all([
    prisma.booking.findMany({ where: { userId: ownerId, status: "CONFIRMED" }, select: { status: true, startDate: true, endDate: true } })
      .then((bookings) => bookings.filter((booking) => isCompletedConfirmedBooking({ dbStatus: booking.status, startDate: booking.startDate, endDate: booking.endDate })).length),
    prisma.profileLike.count({ where: { targetUserId: ownerId } }),
    prisma.travelPhotoLike.count({ where: { photo: { is: { userId: ownerId } } } }),
    prisma.travelTripLike.count({ where: { trip: { is: { userId: ownerId } } } }),
    prisma.review.count({ where: { authorId: ownerId, status: ReviewStatus.PUBLISHED } }),
    getTravelerDestinationStats(ownerId),
    getTravelFollowCounts(ownerId),
  ]);
  const stats = { trips: completedStays, likes: profileLikes + photoLikes + tripLikes, reviews, verifiedCountriesCount: destinationStats.verifiedCountriesCount, verifiedCitiesCount: destinationStats.verifiedCitiesCount };
  const shell = {
    id: profile.id,
    userId: ownerId,
    publicProfileId: profile.publicId,
    handle: fallbackHandle,
    displayName: profile.displayName || profile.user.name || "Traveler",
    avatarUrl: profile.user.image || null,
    visibility: profile.visibility,
    stats,
    isOwner: access.isOwner,
    isFollowing: access.isFollowing,
    followStatus: access.followStatus,
    isBlocked: access.isBlocked,
    followersCount: followCounts.followersCount,
    followingCount: followCounts.followingCount,
  };

  if (!access.canView) {
    return { ...shell, bio: null, homeLocation: null, coverUrl: null, showStamps: false, canViewContent: false, restrictionReason: access.restrictionReason || "PRIVATE", photos: [], highlights: [], stamps: [] };
  }

  const [rawPhotos, highlights, stamps] = await Promise.all([
    prisma.travelPhoto.findMany({
      where: { userId: ownerId, visibility: access.isOwner ? undefined : access.isFollowing ? { in: [TravelProfileVisibility.PUBLIC, TravelProfileVisibility.FOLLOWERS_ONLY] } : TravelProfileVisibility.PUBLIC },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { likes: true } }, likes: viewerId ? { where: { actorId: viewerId }, select: { id: true } } : false, trip: { select: { visibility: true } } },
    }),
    getCountryHighlights(ownerId, { actorId: viewerId }),
    profile.showStamps ? getTravelerStamps(ownerId, { publicOnly: !access.isOwner }) : Promise.resolve([]),
  ]);

  function canExposePhotoVisibility(visibility: string) {
    if (access.isOwner) return true;
    if (visibility === TravelProfileVisibility.PUBLIC) return true;
    if (visibility === TravelProfileVisibility.FOLLOWERS_ONLY && access.isFollowing) return true;
    return false;
  }

  const photos: PublicTravelPhotoDTO[] = rawPhotos.flatMap((photo) => {
    if (!isRenderableTravelPhotoUrl(photo.url)) return [];
    if (photo.trip?.visibility === TravelProfileVisibility.PRIVATE && !access.isOwner) return [];
    if (photo.trip?.visibility === TravelProfileVisibility.FOLLOWERS_ONLY && !access.isFollowing && !access.isOwner) return [];
    if (!canExposePhotoVisibility(photo.visibility)) return [];
    return [{ id: photo.id, url: photo.url, thumbnailUrl: photo.thumbnailUrl, mediumUrl: photo.mediumUrl, caption: photo.caption, location: photo.location, tripId: photo.tripId, likesCount: photo._count.likes, isLiked: Array.isArray(photo.likes) && photo.likes.length > 0, createdAt: photo.createdAt }];
  });

  // public albums exclude photos more private than the viewing relationship:
  // t.photos.filter((photo) => canExposePhotoVisibility(photo.visibility))

  const knownHighlights = new Map(highlights.map((highlight) => [highlight.country.toLowerCase(), highlight]));
  const safeHighlightMap = new Map<string, CountryHighlightDTO>();
  for (const photo of photos) {
    const country = extractCountryFromLocation(photo.location);
    if (!country) continue;
    const key = country.toLowerCase();
    const current = safeHighlightMap.get(key);
    if (current) current.photoCount += 1;
    else {
      const known = knownHighlights.get(key);
      safeHighlightMap.set(key, { country, photoCount: 1, coverUrl: photo.mediumUrl || photo.url, sampleLocation: photo.location || undefined, isVerified: known?.isVerified ?? false });
    }
  }
  for (const highlight of highlights) if (highlight.photoCount === 0 && !safeHighlightMap.has(highlight.country.toLowerCase())) safeHighlightMap.set(highlight.country.toLowerCase(), highlight);

  const safeHighlights = [...safeHighlightMap.values()];
  const publicStamps: PublicTravelStampDTO[] = stamps.map((stamp) => ({ id: stamp.id, slug: stamp.stamp.slug, displayName: stamp.stamp.displayName, description: stamp.stamp.description, iconUrl: stamp.stamp.iconUrl, category: stamp.stamp.category, awardedAt: stamp.awardedAt, isPinned: stamp.isPinned, isPublic: stamp.isPublic, isManual: stamp.isManual }));
  return { ...shell, bio: profile.bio, homeLocation: profile.homeLocation, coverUrl: profile.coverUrl, showStamps: profile.showStamps, canViewContent: true, restrictionReason: null, photos, highlights: safeHighlights, stamps: publicStamps };
}

export async function getPublicTravelProfileByPublicId(
  publicProfileId: string,
  viewerId?: string | null,
): Promise<PublicTravelProfileDTO> {
  const normalized = normalizePublicProfileId(publicProfileId);
  if (!normalized) throw AppError.notFound("Traveler profile not found");

  const profile = await prisma.travelProfile.findUnique({
    where: { publicId: normalized },
    include: { user: { select: { id: true, name: true, image: true } } },
  });
  return getPublicTravelProfile(profile, viewerId);
}

/**
 * Legacy handle URLs remain valid only long enough to redirect to the canonical
 * opaque URL. `traveler` was a UI fallback, never a real public identity.
 */
export async function resolvePublicTravelProfile(
  routeSegment: string,
  viewerId?: string | null,
): Promise<{ profile: PublicTravelProfileDTO; shouldRedirectToCanonical: boolean }> {
  const publicProfileId = normalizePublicProfileId(routeSegment);
  if (publicProfileId) {
    return {
      profile: await getPublicTravelProfileByPublicId(publicProfileId, viewerId),
      shouldRedirectToCanonical: false,
    };
  }

  const handle = normalizeHandle(routeSegment);
  if (!handle || handle === "traveler") {
    throw AppError.notFound("Traveler profile not found");
  }

  const profile = await prisma.travelProfile.findUnique({
    where: { handle },
    include: { user: { select: { id: true, name: true, image: true } } },
  });
  return {
    profile: await getPublicTravelProfile(profile, viewerId),
    shouldRedirectToCanonical: true,
  };
}

/** @deprecated Resolve public URLs with `resolvePublicTravelProfile` instead. */
export async function getPublicTravelProfileByHandle(handle: string, viewerId?: string | null): Promise<PublicTravelProfileDTO> {
  const resolved = await resolvePublicTravelProfile(handle, viewerId);
  return resolved.profile;
}
