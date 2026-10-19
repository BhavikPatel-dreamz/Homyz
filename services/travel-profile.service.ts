import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { invalidateUserCache } from "@/lib/redis/invalidation";
import type {
  DestinationDto,
  TravelProfileDto,
  UpdateTravelProfileInput,
} from "@/lib/validation/travel-trip";

function toDestinationDto(dest: {
  id: string;
  name: string;
  normalizedName: string;
  countryCode: string;
  countryName: string;
  regionName: string | null;
  regionCode: string | null;
  latitude: number | null;
  longitude: number | null;
} | null): DestinationDto | null {
  if (!dest) return null;
  return {
    id: dest.id,
    name: dest.name,
    normalizedName: dest.normalizedName,
    countryCode: dest.countryCode,
    countryName: dest.countryName,
    regionName: dest.regionName,
    regionCode: dest.regionCode,
    latitude: dest.latitude,
    longitude: dest.longitude,
  };
}

export function toTravelProfileDto(profile: {
  id: string;
  userId: string;
  handle: string | null;
  bio: string | null;
  visibility: "PRIVATE" | "CONNECTIONS" | "PUBLIC";
  homeDestinationId: string | null;
  coverMediaId: string | null;
  stampsVisible?: boolean;
  createdAt: Date;
  updatedAt: Date;
  homeDestination?: {
    id: string;
    name: string;
    normalizedName: string;
    countryCode: string;
    countryName: string;
    regionName: string | null;
    regionCode: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  user?: {
    id: string;
    name: string | null;
    image: string | null;
    email: string | null;
  } | null;
}): TravelProfileDto {
  return {
    id: profile.id,
    userId: profile.userId,
    handle: profile.handle,
    bio: profile.bio,
    visibility: profile.visibility,
    homeDestination: toDestinationDto(profile.homeDestination || null),
    coverMediaId: profile.coverMediaId,
    coverUrl: profile.coverMediaId
      ? `/api/v1/travel-media/${profile.coverMediaId}/file`
      : null,
    coverImageUrl: profile.coverMediaId
      ? `/api/v1/travel-media/${profile.coverMediaId}/file`
      : null,
    stampsVisible: profile.stampsVisible ?? true,
    user: {
      id: profile.user?.id || profile.userId,
      name: profile.user?.name || null,
      image: profile.user?.image || null,
      email: profile.user?.email || null,
    },
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function getOrCreateTravelProfile(userId: string): Promise<TravelProfileDto> {
  let profile = await prisma.travelProfile.findUnique({
    where: { userId },
    include: {
      homeDestination: true,
      user: {
        select: { id: true, name: true, image: true, email: true },
      },
    },
  });

  if (!profile) {
    profile = await prisma.travelProfile.create({
      data: {
        userId,
        visibility: "PRIVATE",
      },
      include: {
        homeDestination: true,
        user: {
          select: { id: true, name: true, image: true, email: true },
        },
      },
    });
  }

  return toTravelProfileDto(profile);
}

export async function updateTravelProfile(
  userId: string,
  input: UpdateTravelProfileInput,
): Promise<TravelProfileDto> {
  // Ensure profile exists
  await getOrCreateTravelProfile(userId);

  // If handle provided, check uniqueness
  if (input.handle) {
    const existing = await prisma.travelProfile.findFirst({
      where: {
        handle: input.handle,
        NOT: { userId },
      },
    });
    if (existing) {
      throw AppError.badRequest("This travel handle is already taken.");
    }
  }

  // Update profile data
  const updatedProfile = await prisma.travelProfile.update({
    where: { userId },
    data: {
      bio: input.bio !== undefined ? input.bio : undefined,
      handle: input.handle !== undefined ? input.handle : undefined,
      visibility: input.visibility !== undefined ? input.visibility : undefined,
      homeDestinationId:
        input.homeDestinationId !== undefined ? input.homeDestinationId : undefined,
    },
    include: {
      homeDestination: true,
      user: {
        select: { id: true, name: true, image: true, email: true, publicProfile: true },
      },
    },
  });

  // Sync basic display info with user record if provided
  if (input.displayName || input.bio !== undefined || input.location !== undefined) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { publicProfile: true },
    });
    const currentPub = (user?.publicProfile as Record<string, unknown>) || {};
    const updatedPub = {
      ...currentPub,
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.location !== undefined ? { whereILive: input.location } : {}),
    };

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName ? { name: input.displayName } : {}),
        publicProfile: updatedPub,
      },
      select: { id: true, name: true, image: true, email: true },
    });

    await invalidateUserCache(userId);
    return toTravelProfileDto({ ...updatedProfile, user: updatedUser });
  }

  return toTravelProfileDto(updatedProfile);
}

export async function setTravelProfileCover(
  userId: string,
  coverMediaId: string,
): Promise<TravelProfileDto> {
  // Validate that media asset exists, belongs to user, and is READY
  const asset = await prisma.travelMediaAsset.findUnique({
    where: { id: coverMediaId },
  });

  if (!asset || asset.ownerId !== userId || asset.deletedAt) {
    throw AppError.notFound("Cover image not found or unauthorized.");
  }

  if (asset.uploadStatus !== "READY") {
    throw AppError.badRequest("Cover image is still processing or upload failed.");
  }

  const updatedProfile = await prisma.travelProfile.update({
    where: { userId },
    data: {
      coverMediaId,
    },
    include: {
      homeDestination: true,
      user: {
        select: { id: true, name: true, image: true, email: true },
      },
    },
  });

  await invalidateUserCache(userId);
  return toTravelProfileDto(updatedProfile);
}

export async function removeTravelProfileCover(userId: string): Promise<TravelProfileDto> {
  const updatedProfile = await prisma.travelProfile.update({
    where: { userId },
    data: {
      coverMediaId: null,
    },
    include: {
      homeDestination: true,
      user: {
        select: { id: true, name: true, image: true, email: true },
      },
    },
  });

  await invalidateUserCache(userId);
  return toTravelProfileDto(updatedProfile);
}
