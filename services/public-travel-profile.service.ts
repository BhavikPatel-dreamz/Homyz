import { AppError } from "@/lib/api/errors";
import { isCompletedConfirmedBooking } from "@/lib/booking/booking-status";
import { prisma } from "@/lib/db/prisma";
import { ReviewStatus, TravelProfileVisibility } from "@/generated/prisma/client";
import type { CountryHighlightDTO, PublicTravelPhotoDTO, PublicTravelProfileDTO, PublicTravelStampDTO } from "@/types/travel";
import { getTravelerDestinationStats } from "./travel-destination.service";
import { extractCountryFromLocation, getCountryHighlights } from "./travel-photo.service";
import { canViewTravelProfile } from "./travel-privacy.service";
import { normalizeHandle } from "./travel-profile.service";
import { getTravelerStamps } from "./travel-stamp.service";

export type { PublicTravelPhotoDTO, PublicTravelProfileDTO, PublicTravelStampDTO } from "@/types/travel";

export function getCanonicalProfileUrl(handle: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://homyz.co";
  return `${origin.replace(/\/+$/, "")}/travelers/${encodeURIComponent(handle)}`;
}

export async function getPublicTravelProfileByHandle(handle: string, viewerId?: string | null): Promise<PublicTravelProfileDTO> {
  const normalized = normalizeHandle(handle);
  if (!normalized) throw AppError.badRequest("Invalid traveler handle");

  const profile = await prisma.travelProfile.findUnique({
    where: { handle: normalized },
    include: { user: { select: { id: true, name: true, image: true } } },
  });
  if (!profile) throw AppError.notFound("Traveler profile not found");

  const ownerId = profile.userId;
  const access = await canViewTravelProfile(viewerId, ownerId);
  const [completedStays, likes, reviews, destinationStats] = await Promise.all([
    prisma.booking.findMany({ where: { userId: ownerId, status: "CONFIRMED" }, select: { status: true, startDate: true, endDate: true } })
      .then((bookings) => bookings.filter((booking) => isCompletedConfirmedBooking({ dbStatus: booking.status, startDate: booking.startDate, endDate: booking.endDate })).length),
    prisma.profileLike.count({ where: { targetUserId: ownerId } }),
    prisma.review.count({ where: { authorId: ownerId, status: ReviewStatus.PUBLISHED } }),
    getTravelerDestinationStats(ownerId),
  ]);
  const stats = { trips: completedStays, likes, reviews, verifiedCountriesCount: destinationStats.verifiedCountriesCount, verifiedCitiesCount: destinationStats.verifiedCitiesCount };
  const shell = {
    id: profile.id,
    userId: ownerId,
    handle: profile.handle || normalized,
    displayName: profile.displayName || profile.user.name || "Traveler",
    avatarUrl: profile.user.image || null,
    visibility: profile.visibility,
    stats,
    isOwner: access.isOwner,
    isFollowing: access.isFollowing,
    followStatus: access.followStatus,
    isBlocked: access.isBlocked,
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
    getCountryHighlights(ownerId),
    profile.showStamps ? getTravelerStamps(ownerId, { publicOnly: !access.isOwner }) : Promise.resolve([]),
  ]);

  function canExposePhotoVisibility(visibility: string) {
    if (access.isOwner) return true;
    if (visibility === TravelProfileVisibility.PUBLIC) return true;
    if (visibility === TravelProfileVisibility.FOLLOWERS_ONLY && access.isFollowing) return true;
    return false;
  }

  const photos: PublicTravelPhotoDTO[] = rawPhotos.flatMap((photo) => {
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
