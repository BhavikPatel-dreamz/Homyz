import { z } from "zod";

export const MAX_PHOTOS_PER_TRIP = 5;

export const tripTitleSchema = z
  .string()
  .trim()
  .min(1, "Trip title is required.")
  .max(100, "Trip title cannot exceed 100 characters.");

export const tripDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "Trip description cannot exceed 2,000 characters.")
  .optional()
  .nullable();

export const tripDateSchema = z
  .string()
  .trim()
  .refine(
    (value) => !value || !isNaN(Date.parse(value)),
    "Must be a valid ISO date string.",
  )
  .optional()
  .nullable();

export const createTripSchema = z
  .object({
    title: tripTitleSchema,
    description: tripDescriptionSchema,
    destinationId: z.string().trim().min(1, "Invalid destination ID.").optional().nullable(),
    startedAt: tripDateSchema,
    endedAt: tripDateSchema,
  })
  .refine(
    (data) => {
      if (data.startedAt && data.endedAt) {
        return new Date(data.startedAt) <= new Date(data.endedAt);
      }
      return true;
    },
    {
      message: "Start date cannot be after end date.",
      path: ["endedAt"],
    },
  );

export type CreateTripInput = z.infer<typeof createTripSchema>;

export const updateTripSchema = z
  .object({
    title: tripTitleSchema.optional(),
    description: tripDescriptionSchema,
    destinationId: z.string().trim().min(1).optional().nullable(),
    startedAt: tripDateSchema,
    endedAt: tripDateSchema,
    coverPhotoId: z.string().trim().min(1).optional().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  })
  .refine(
    (data) => {
      if (data.startedAt && data.endedAt) {
        return new Date(data.startedAt) <= new Date(data.endedAt);
      }
      return true;
    },
    {
      message: "Start date cannot be after end date.",
      path: ["endedAt"],
    },
  );

export type UpdateTripInput = z.infer<typeof updateTripSchema>;

export const attachTripPhotoSchema = z.object({
  mediaAssetId: z.string().trim().min(1, "Media asset ID is required."),
  caption: z.string().trim().max(500, "Caption cannot exceed 500 characters.").optional().nullable(),
  location: z.string().trim().max(150, "Location cannot exceed 150 characters.").optional().nullable(),
  destinationId: z.string().trim().min(1).optional().nullable(),
  displayOrder: z.number().int().min(0).max(5).optional(),
});

export type AttachTripPhotoInput = z.infer<typeof attachTripPhotoSchema>;

export const setTripCoverSchema = z.object({
  photoId: z.string().trim().min(1, "Photo ID is required."),
});

export type SetTripCoverInput = z.infer<typeof setTripCoverSchema>;

export const addSelfDeclaredDestinationSchema = z.object({
  name: z.string().trim().min(1, "Destination name is required.").max(150),
  countryCode: z.string().trim().length(2, "Country code must be a 2-letter ISO code.").toUpperCase(),
  countryName: z.string().trim().min(1).max(150).optional(),
  regionName: z.string().trim().max(150).optional().nullable(),
  regionCode: z.string().trim().max(10).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  providerPlaceId: z.string().trim().max(255).optional().nullable(),
  firstVisitedAt: tripDateSchema,
  lastVisitedAt: tripDateSchema,
});

export type AddSelfDeclaredDestinationInput = z.infer<typeof addSelfDeclaredDestinationSchema>;

export const destinationSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "Search query must not be empty.").max(100),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export type DestinationSearchQuery = z.infer<typeof destinationSearchQuerySchema>;

export const updateTravelPhotoSchema = z.object({
  caption: z.string().trim().max(500, "Caption cannot exceed 500 characters.").optional().nullable(),
  location: z.string().trim().max(150, "Location cannot exceed 150 characters.").optional().nullable(),
  destinationId: z.string().trim().min(1).optional().nullable(),
});

export type UpdateTravelPhotoInput = z.infer<typeof updateTravelPhotoSchema>;

export const addPhotoTagSchema = z.object({
  taggedUserId: z.string().trim().min(1, "Tagged user ID is required."),
});

export type AddPhotoTagInput = z.infer<typeof addPhotoTagSchema>;

export const updateTravelProfileSchema = z.object({
  bio: z.string().trim().max(500, "Bio cannot exceed 500 characters.").optional().nullable(),
  handle: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,30}$/, "Handle must be 3-30 alphanumeric characters or underscores.")
    .optional()
    .nullable(),
  visibility: z.enum(["PRIVATE", "CONNECTIONS", "PUBLIC"]).optional(),
  homeDestinationId: z.string().trim().min(1).optional().nullable(),
  displayName: z.string().trim().min(1).max(100).optional(),
  location: z.string().trim().max(150).optional().nullable(),
});

export type UpdateTravelProfileInput = z.infer<typeof updateTravelProfileSchema>;

export const allPhotosQuerySchema = z.object({
  tripId: z.string().trim().min(1).optional(),
  destinationId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  cursor: z.string().trim().min(1).optional(),
});

export type AllPhotosQuery = z.infer<typeof allPhotosQuerySchema>;

// DTO shapes
export interface DestinationDto {
  id: string;
  name: string;
  normalizedName: string;
  countryCode: string;
  countryName: string;
  regionName: string | null;
  regionCode: string | null;
  latitude: number | null;
  longitude: number | null;
  providerPlaceId?: string | null;
}

export interface PhotoTagDto {
  id: string;
  photoId: string;
  taggedUserId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  taggedUser?: {
    id: string;
    name: string | null;
    image: string | null;
  };
  createdAt: string;
}

export interface TravelPhotoOwnerDto {
  id: string;
  tripId: string;
  tripTitle?: string;
  mediaAssetId: string;
  caption: string | null;
  location: string | null;
  destinationId: string | null;
  destination?: DestinationDto | null;
  displayOrder: number;
  isCover: boolean;
  thumbnailUrl: string | null;
  mediumUrl: string | null;
  mediaAsset?: {
    url: string;
  } | null;
  tags?: PhotoTagDto[];
  createdAt: string;
}

export interface TravelTripOwnerDto {
  id: string;
  title: string;
  description: string | null;
  destination: DestinationDto | null;
  startedAt: string | null;
  endedAt: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  coverPhotoId: string | null;
  coverThumbnailUrl: string | null;
  photoCount: number;
  photos?: TravelPhotoOwnerDto[];
  createdAt: string;
  updatedAt: string;
}

export interface UserDestinationDto {
  id: string;
  destinationId: string;
  name: string;
  countryCode: string;
  countryName: string;
  regionName: string | null;
  isVerified: boolean;
  source: "BOOKING_VERIFIED" | "SELF_DECLARED";
  selfDeclared: boolean;
  firstVisitedAt: string | null;
  lastVisitedAt: string | null;
  activeEvidenceCount: number;
  tripsCount: number;
  tripCount?: number;
  createdAt: string;
}

export interface TravelStatsDto {
  verifiedTrips: number;
  travelAlbums: number;
  verifiedCities: number;
  verifiedCountries: number;
  visitedCities: number;
  visitedCountries: number;
  albumPhotos: number;
}

export interface TravelProfileDto {
  id: string;
  userId: string;
  handle: string | null;
  bio: string | null;
  displayName?: string | null;
  homeLocation?: string | null;
  visibility: "PRIVATE" | "CONNECTIONS" | "PUBLIC";
  homeDestination: DestinationDto | null;
  coverMediaId: string | null;
  coverUrl: string | null;
  coverPhotoUrl?: string | null;
  coverImageUrl?: string | null;
  stampsVisible?: boolean;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    email?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}
