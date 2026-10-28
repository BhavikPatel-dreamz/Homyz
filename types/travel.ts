/**
 * HOMYZ Travel Profile & Social Identity - Shared Types and Client-Safe Constants
 *
 * This file contains strictly browser-safe types, interfaces, and constants.
 * It has NO dependency on Prisma, database adapters, or Node.js built-ins.
 */

export const MAX_PHOTOS_PER_TRIP = 5;

export const TravelProfileVisibility = {
  PUBLIC: "PUBLIC",
  FOLLOWERS_ONLY: "FOLLOWERS_ONLY",
  PRIVATE: "PRIVATE",
} as const;

export type TravelProfileVisibility =
  (typeof TravelProfileVisibility)[keyof typeof TravelProfileVisibility];

export const TravelFollowStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
} as const;

export type TravelFollowStatus =
  (typeof TravelFollowStatus)[keyof typeof TravelFollowStatus];

export interface TravelPhotoDTO {
  id: string;
  userId: string;
  tripId: string | null;
  tripTitle?: string | null;
  url: string;
  thumbnailUrl: string | null;
  mediumUrl: string | null;
  caption: string | null;
  location: string | null;
  /** Present only for legacy TripPhoto compatibility records. */
  tags?: string[];
  order: number;
  likesCount?: number;
  isLiked?: boolean;
  author?: {
    id: string;
    name: string | null;
    image: string | null;
  };
  prevPhotoId?: string | null;
  nextPhotoId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  isLegacy?: boolean;
}

export interface TravelTripDTO {
  id: string;
  userId: string;
  title: string;
  destinationId: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  coverPhotoId: string | null;
  coverUrl?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  photoCount: number;
  remainingCapacity: number;
  photos?: TravelPhotoDTO[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CountryHighlightDTO {
  country: string;
  /** ISO country code when this highlight is associated with a normalized Destination. */
  countryCode?: string | null;
  photoCount: number;
  /** A stored travel photo when one exists; verified destinations may have no photo yet. */
  coverUrl: string | null;
  sampleLocation?: string;
  isVerified?: boolean;
}

export interface TravelProfileDTO {
  id: string;
  userId: string;
  handle: string | null;
  displayName?: string | null;
  bio: string | null;
  homeLocation: string | null;
  coverUrl: string | null;
  visibility: "PUBLIC" | "PRIVATE" | "FOLLOWERS_ONLY";
  showStamps?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    createdAt: Date | string;
  };
}

export interface UpdateTravelProfileInput {
  displayName?: string | null;
  handle?: string | null;
  bio?: string | null;
  homeLocation?: string | null;
  visibility?: "PUBLIC" | "PRIVATE" | "FOLLOWERS_ONLY";
  coverUrl?: string | null;
  avatarUrl?: string | null;
}

export interface TravelProfileStatsDTO {
  trips: number;
  likes: number;
  reviews: number;
}

export interface TravelStampDTO {
  id: string;
  slug: string;
  displayName: string;
  title?: string | null;
  city?: string | null;
  country?: string | null;
  description: string | null;
  countryCode: string | null;
  iconUrl: string | null;
  imageUrl?: string | null;
  category: string;
  eligibilityRule: string;
  ruleThreshold: number;
  isActive?: boolean;
  displayOrder?: number;
  /** Personal artwork is visible only to its owner in the picker and never awards verification. */
  isCustom?: boolean;
}

export interface AdminTravelStampDTO {
  id: string;
  slug: string;
  displayName: string;
  title: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  description: string | null;
  iconUrl: string | null;
  imageUrl: string | null;
  category: string;
  isActive: boolean;
  displayOrder: number;
  collectorCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UserTravelStampDTO {
  id: string;
  userId: string;
  stampId: string;
  stamp: TravelStampDTO;
  awardedAt: Date | string;
  isPinned: boolean;
  displayOrder: number;
  /** Whether this stamp is selected for the public profile when the section is visible. */
  isPublic: boolean;
  /** Manual stamps are personal declarations and never count as verified travel. */
  isManual: boolean;
  visitDate?: Date | string | null;
  personalDescription?: string | null;
}

export interface TravelStampPickerItemDTO {
  id: string;
  kind: "CATALOG" | "DESTINATION";
  displayName: string;
  description: string | null;
  countryName: string | null;
  cityName: string | null;
  iconUrl: string | null;
  category: string;
  isAlreadyCollected: boolean;
  isVerifiedSuggestion: boolean;
  isCustom?: boolean;
}

export interface TravelStampPickerPageDTO {
  items: TravelStampPickerItemDTO[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

export interface TravelerDestinationStatsDTO {
  verifiedCountriesCount: number;
  verifiedCitiesCount: number;
  completedStaysCount: number;
  totalVisitsCount: number;
}

export interface PublicTravelPhotoDTO {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  mediumUrl: string | null;
  caption: string | null;
  location: string | null;
  tripId: string | null;
  likesCount: number;
  isLiked: boolean;
  createdAt: Date | string;
}

export interface PublicTravelStampDTO {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  iconUrl: string | null;
  category: string;
  awardedAt: Date | string;
  isPinned: boolean;
  isPublic: boolean;
  isManual: boolean;
}

export interface PublicTravelProfileDTO {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  name?: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  homeLocation: string | null;
  bio: string | null;
  visibility: TravelProfileVisibility;
  showStamps?: boolean;
  canViewContent: boolean;
  isOwner?: boolean;
  isFollowing: boolean;
  followStatus: string;
  isBlocked?: boolean;
  followersCount?: number;
  followingCount?: number;
  restrictionReason?: "PRIVATE" | "FOLLOWERS_ONLY" | "BLOCKED" | null;
  stats: {
    trips: number;
    likes: number;
    reviews: number;
    verifiedCountriesCount?: number;
    verifiedCitiesCount?: number;
  };
  photos: PublicTravelPhotoDTO[];
  highlights: CountryHighlightDTO[];
  stamps: PublicTravelStampDTO[];
}
