export const PHOTO_TOUR_CATEGORY_GROUPS = [
  { id: "main_rooms", label: "Rooms" },
  { id: "work_entertainment", label: "Work & Entertainment" },
  { id: "indoor_areas", label: "Indoor Areas" },
  { id: "outdoor_areas", label: "Outdoor Spaces" },
  { id: "amenities_special_areas", label: "Amenities & Special Areas" },
  { id: "parking_access", label: "Parking & Access" },
  { id: "views_surroundings", label: "Views & Surroundings" },
  { id: "other", label: "Other" },
] as const;

export type PhotoTourCategoryGroupId = (typeof PHOTO_TOUR_CATEGORY_GROUPS)[number]["id"];

export const PHOTO_ROOM_TYPES = [
  "LIVING_ROOM",
  "FAMILY_ROOM",
  "BEDROOM",
  "PRIMARY_BEDROOM",
  "GUEST_BEDROOM",
  "KIDS_BEDROOM",
  "BATHROOM",
  "HALF_BATHROOM",
  "KITCHEN",
  "DINING_ROOM",
  "WORKSPACE",
  "STUDY_ROOM",
  "GAME_ROOM",
  "MEDIA_ROOM",
  "LIBRARY",
  "GYM_ROOM",
  "ENTRANCE",
  "HALLWAY",
  "LOBBY",
  "LAUNDRY_ROOM",
  "CLOSET",
  "STORAGE_AREA",
  "BASEMENT",
  "ATTIC",
  "BALCONY",
  "TERRACE",
  "PATIO",
  "GARDEN",
  "BACKYARD",
  "COURTYARD",
  "ROOFTOP",
  "OUTDOOR_DINING_AREA",
  "OUTDOOR_KITCHEN",
  "SWIMMING_POOL",
  "HOT_TUB",
  "SAUNA",
  "SPA",
  "GYM",
  "FIREPLACE_AREA",
  "BBQ_AREA",
  "FIRE_PIT",
  "GARAGE",
  "PARKING_AREA",
  "DRIVEWAY",
  "BUILDING_ENTRANCE",
  "ELEVATOR_AREA",
  "CITY_VIEW",
  "MOUNTAIN_VIEW",
  "OCEAN_VIEW",
  "BEACH",
  "LAKE_RIVER_VIEW",
  "GARDEN_VIEW",
  "PROPERTY_EXTERIOR",
  "OTHER_SPACE",
  "UNASSIGNED_PHOTOS",
  "DINING_AREA",
  "EXTERIOR",
  "PATIO_BALCONY",
  "POOL_HOT_TUB",
  "LAUNDRY",
  "VIEW",
  "PARKING",
  "OTHER",
] as const;

export type PhotoRoomType = (typeof PHOTO_ROOM_TYPES)[number];

export type PhotoTourCategory = {
  id: PhotoRoomType;
  label: string;
  group: PhotoTourCategoryGroupId;
  description?: string;
};

export const PHOTO_TOUR_CATEGORIES: PhotoTourCategory[] = [
  { id: "LIVING_ROOM", label: "Living Room", group: "main_rooms" },
  { id: "FAMILY_ROOM", label: "Family Room", group: "main_rooms" },
  { id: "BEDROOM", label: "Bedroom", group: "main_rooms" },
  { id: "PRIMARY_BEDROOM", label: "Primary Bedroom", group: "main_rooms" },
  { id: "GUEST_BEDROOM", label: "Guest Bedroom", group: "main_rooms" },
  { id: "KIDS_BEDROOM", label: "Kids Bedroom", group: "main_rooms" },
  { id: "BATHROOM", label: "Bathroom", group: "main_rooms" },
  { id: "HALF_BATHROOM", label: "Half Bathroom / Powder Room", group: "main_rooms" },
  { id: "KITCHEN", label: "Kitchen", group: "main_rooms" },
  { id: "DINING_ROOM", label: "Dining Room", group: "main_rooms" },
  { id: "WORKSPACE", label: "Workspace / Office", group: "work_entertainment" },
  { id: "STUDY_ROOM", label: "Study Room", group: "work_entertainment" },
  { id: "GAME_ROOM", label: "Game Room", group: "work_entertainment" },
  { id: "MEDIA_ROOM", label: "Media / TV Room", group: "work_entertainment" },
  { id: "LIBRARY", label: "Library", group: "work_entertainment" },
  { id: "GYM_ROOM", label: "Gym / Fitness Room", group: "work_entertainment" },
  { id: "ENTRANCE", label: "Entrance", group: "indoor_areas" },
  { id: "HALLWAY", label: "Hallway", group: "indoor_areas" },
  { id: "LOBBY", label: "Lobby", group: "indoor_areas" },
  { id: "LAUNDRY_ROOM", label: "Laundry Room", group: "indoor_areas" },
  { id: "CLOSET", label: "Closet / Wardrobe", group: "indoor_areas" },
  { id: "STORAGE_AREA", label: "Storage Area", group: "indoor_areas" },
  { id: "BASEMENT", label: "Basement", group: "indoor_areas" },
  { id: "ATTIC", label: "Attic", group: "indoor_areas" },
  { id: "BALCONY", label: "Balcony", group: "outdoor_areas" },
  { id: "TERRACE", label: "Terrace", group: "outdoor_areas" },
  { id: "PATIO", label: "Patio", group: "outdoor_areas" },
  { id: "GARDEN", label: "Garden", group: "outdoor_areas" },
  { id: "BACKYARD", label: "Backyard", group: "outdoor_areas" },
  { id: "COURTYARD", label: "Courtyard", group: "outdoor_areas" },
  { id: "ROOFTOP", label: "Rooftop", group: "outdoor_areas" },
  { id: "OUTDOOR_DINING_AREA", label: "Outdoor Dining Area", group: "outdoor_areas" },
  { id: "OUTDOOR_KITCHEN", label: "Outdoor Kitchen", group: "outdoor_areas" },
  { id: "SWIMMING_POOL", label: "Swimming Pool", group: "amenities_special_areas" },
  { id: "HOT_TUB", label: "Hot Tub / Jacuzzi", group: "amenities_special_areas" },
  { id: "SAUNA", label: "Sauna", group: "amenities_special_areas" },
  { id: "SPA", label: "Spa", group: "amenities_special_areas" },
  { id: "GYM", label: "Gym", group: "amenities_special_areas" },
  { id: "FIREPLACE_AREA", label: "Fireplace Area", group: "amenities_special_areas" },
  { id: "BBQ_AREA", label: "BBQ Area", group: "amenities_special_areas" },
  { id: "FIRE_PIT", label: "Fire Pit", group: "amenities_special_areas" },
  { id: "GARAGE", label: "Garage", group: "parking_access" },
  { id: "PARKING_AREA", label: "Parking Area", group: "parking_access" },
  { id: "DRIVEWAY", label: "Driveway", group: "parking_access" },
  { id: "BUILDING_ENTRANCE", label: "Building Entrance", group: "parking_access" },
  { id: "ELEVATOR_AREA", label: "Elevator / Lift Area", group: "parking_access" },
  { id: "CITY_VIEW", label: "City View", group: "views_surroundings" },
  { id: "MOUNTAIN_VIEW", label: "Mountain View", group: "views_surroundings" },
  { id: "OCEAN_VIEW", label: "Ocean / Sea View", group: "views_surroundings" },
  { id: "BEACH", label: "Beach", group: "views_surroundings" },
  { id: "LAKE_RIVER_VIEW", label: "Lake / River View", group: "views_surroundings" },
  { id: "GARDEN_VIEW", label: "Garden View", group: "views_surroundings" },
  { id: "PROPERTY_EXTERIOR", label: "Property Exterior", group: "views_surroundings" },
  { id: "OTHER_SPACE", label: "Other Space", group: "other" },
  { id: "UNASSIGNED_PHOTOS", label: "Unassigned Photos", group: "other" },
  { id: "DINING_AREA", label: "Dining Area", group: "main_rooms" },
  { id: "EXTERIOR", label: "Exterior", group: "views_surroundings" },
  { id: "PATIO_BALCONY", label: "Patio or Balcony", group: "outdoor_areas" },
  { id: "POOL_HOT_TUB", label: "Pool or Hot Tub", group: "amenities_special_areas" },
  { id: "LAUNDRY", label: "Laundry", group: "indoor_areas" },
  { id: "VIEW", label: "View", group: "views_surroundings" },
  { id: "PARKING", label: "Parking", group: "parking_access" },
  { id: "OTHER", label: "Other", group: "other" },
];

export const PHOTO_TOUR_CATEGORY_LOOKUP = new Map(
  PHOTO_TOUR_CATEGORIES.map((category) => [category.id, category]),
);

export function getPhotoTourCategoryById(id: string | null | undefined) {
  if (typeof id !== "string") return undefined;
  const normalized = id.trim();
  if (!normalized) return undefined;
  const directMatch = PHOTO_TOUR_CATEGORY_LOOKUP.get(normalized as PhotoRoomType);
  if (directMatch) return directMatch;
  const normalizedKey = normalized.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return PHOTO_TOUR_CATEGORY_LOOKUP.get(normalizedKey as PhotoRoomType);
}

export function resolvePhotoRoomType(value: unknown): PhotoRoomType | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isPhotoRoomType(trimmed)) return trimmed as PhotoRoomType;
  const byLabel = PHOTO_TOUR_CATEGORIES.find(
    (category) => category.label.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byLabel) return byLabel.id;
  const normalized = trimmed.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return getPhotoTourCategoryById(normalized)?.id ?? null;
}

export type PhotoRoomAssignment = {
  url: string;
  roomType?: PhotoRoomType | null;
  roomCategory?: string | null;
  roomInstanceId?: string | null;
  roomLabel?: string | null;
  sortOrder?: number | null;
  [key: string]: unknown;
};

export function isPhotoRoomType(value: unknown): value is PhotoRoomType {
  return typeof value === "string" && (PHOTO_ROOM_TYPES as readonly string[]).includes(value);
}

/**
 * Keeps photo-tour metadata backward compatible with the existing `photos`
 * string array. Invalid, unassigned, duplicate, and removed-photo entries are
 * discarded so changing a room never changes the underlying media URL.
 */
export function normalizePhotoRoomAssignments(
  value: unknown,
  photos: readonly string[],
): PhotoRoomAssignment[] {
  if (!Array.isArray(value)) return [];

  const photoUrls = new Set(photos);
  const seen = new Set<string>();

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const raw = entry as Record<string, unknown>;
    const url = typeof raw.url === "string" ? raw.url : null;
    const roomType = resolvePhotoRoomType(raw.roomType ?? raw.roomCategory ?? raw.categoryId ?? raw.roomCategoryId ?? null);
    if (typeof url !== "string" || !photoUrls.has(url) || seen.has(url) || !roomType) {
      return [];
    }
    seen.add(url);

    const normalized: PhotoRoomAssignment = { url, roomType };
    if (typeof raw.roomCategory === "string") normalized.roomCategory = raw.roomCategory.trim() || null;
    if (typeof raw.roomInstanceId === "string") normalized.roomInstanceId = raw.roomInstanceId.trim() || null;
    if (typeof raw.roomLabel === "string") normalized.roomLabel = raw.roomLabel.trim() || null;
    if (typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)) normalized.sortOrder = raw.sortOrder;

    Object.entries(raw).forEach(([key, nextValue]) => {
      if (key === "url" || key === "roomType" || key === "roomCategory" || key === "roomInstanceId" || key === "roomLabel" || key === "sortOrder" || key === "categoryId" || key === "roomCategoryId") return;
      if (nextValue !== undefined) normalized[key] = nextValue;
    });

    return [normalized];
  });
}
