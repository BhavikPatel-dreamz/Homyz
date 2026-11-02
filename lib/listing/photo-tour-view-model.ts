import {
  PHOTO_TOUR_CATEGORIES,
  resolvePhotoRoomType,
  type PhotoRoomAssignment,
  type PhotoRoomType,
} from "@/lib/listing/photo-room-assignments";

export type RoomItemLike = {
  id: string;
  name?: string;
  type?: string;
  beds?: Array<{ type: string; count: number }>;
  amenities?: string[];
  hasPrivateBathroom?: boolean;
  privacy?: Record<string, unknown>;
  [key: string]: unknown;
};

export type TourPhotoItem = {
  id: string;
  url: string;
  globalIndex: number;
  roomIndex: number;
  roomId: string;
  roomName: string;
  caption?: string | null;
  sortOrder?: number | null;
};

export type LayoutBlock =
  | { type: "single"; photo: TourPhotoItem }
  | { type: "two-column"; photos: [TourPhotoItem, TourPhotoItem] }
  | { type: "feature-right-stacked"; feature: TourPhotoItem; stacked: [TourPhotoItem, TourPhotoItem] }
  | { type: "feature-left-stacked"; stacked: [TourPhotoItem, TourPhotoItem]; feature: TourPhotoItem }
  | { type: "two-by-two"; photos: [TourPhotoItem, TourPhotoItem, TourPhotoItem, TourPhotoItem] };

export type TourRoomSection = {
  id: string;
  title: string;
  roomType: PhotoRoomType | "UNASSIGNED" | "ALL";
  details?: string | null;
  photos: TourPhotoItem[];
  coverPhoto: TourPhotoItem;
  blocks: LayoutBlock[];
};

export type PhotoTourViewModel = {
  totalPhotos: number;
  sections: TourRoomSection[];
  allPhotos: TourPhotoItem[];
  photoByUrl: Map<string, TourPhotoItem>;
};

// Helpful map of common room-relevant amenity hints when host hasn't attached detailed room amenities
const ROOM_AMENITY_HINTS: Record<string, string[]> = {
  LIVING_ROOM: ["air_conditioning", "tv", "heating", "wifi", "indoor_fireplace", "sound_system"],
  FAMILY_ROOM: ["air_conditioning", "tv", "heating", "wifi", "indoor_fireplace"],
  KITCHEN: ["refrigerator", "microwave", "dishwasher", "cooking_basics", "dishes_and_silverware", "oven", "stove", "coffee_maker"],
  DINING_ROOM: ["dining_table", "dishes_and_silverware"],
  DINING_AREA: ["dining_table", "dishes_and_silverware"],
  BEDROOM: ["air_conditioning", "hangers", "iron", "extra_pillows_and_blankets", "bed_linens", "room_darkening_shades"],
  PRIMARY_BEDROOM: ["air_conditioning", "hangers", "iron", "extra_pillows_and_blankets", "bed_linens"],
  GUEST_BEDROOM: ["air_conditioning", "hangers", "iron", "extra_pillows_and_blankets"],
  BATHROOM: ["hair_dryer", "shampoo", "hot_water", "body_soap", "bathtub", "bidet"],
  HALF_BATHROOM: ["hot_water", "soap", "toilet_paper"],
  WORKSPACE: ["dedicated_workspace", "wifi", "desk", "office_chair"],
  STUDY_ROOM: ["dedicated_workspace", "wifi", "books"],
  BALCONY: ["outdoor_furniture", "balcony", "view"],
  PATIO: ["outdoor_furniture", "outdoor_dining_area", "bbq_grill"],
  TERRACE: ["outdoor_furniture", "outdoor_dining_area", "view"],
  GARDEN: ["outdoor_furniture", "garden", "bbq_grill"],
  BACKYARD: ["outdoor_furniture", "bbq_grill", "fire_pit"],
  SWIMMING_POOL: ["pool", "sun_loungers", "pool_towels"],
  HOT_TUB: ["hot_tub", "spa"],
  GYM: ["gym", "exercise_equipment"],
  LAUNDRY_ROOM: ["washer", "dryer", "iron"],
  LAUNDRY: ["washer", "dryer"],
};

function cleanCategoryLabel(label: string): string {
  if (!label) return label;
  if (label.includes(" / ")) {
    return label.split(" / ")[0].trim();
  }
  return label;
}

function formatAmenityLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveRoomDetails(
  roomType: string,
  matchingRoomItem?: RoomItemLike,
  listingAmenities?: string[],
): string | null {
  const detailsParts: string[] = [];

  // 1. Bed configurations if bedroom
  if (matchingRoomItem?.beds && Array.isArray(matchingRoomItem.beds) && matchingRoomItem.beds.length > 0) {
    const bedSummary = matchingRoomItem.beds
      .filter((b) => b && typeof b.count === "number" && b.count > 0)
      .map((b) => {
        const typeName = (b.type || "bed").replace(/_/g, " ").toLowerCase();
        return `${b.count} ${typeName} ${b.count > 1 ? "beds" : "bed"}`;
      })
      .join(", ");
    if (bedSummary) detailsParts.push(bedSummary);
  }

  // 2. Room-specific amenities if explicitly defined on room
  if (matchingRoomItem?.amenities && Array.isArray(matchingRoomItem.amenities) && matchingRoomItem.amenities.length > 0) {
    const customAmenities = matchingRoomItem.amenities
      .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
      .slice(0, 3)
      .map(formatAmenityLabel)
      .join(", ");
    if (customAmenities) detailsParts.push(customAmenities);
  }

  // 3. Private bathroom badge / note
  if (matchingRoomItem?.hasPrivateBathroom) {
    detailsParts.push("Private attached bathroom");
  }

  // 4. If no custom amenities or beds found yet, check relevant listing amenities
  if (detailsParts.length === 0 && Array.isArray(listingAmenities) && listingAmenities.length > 0) {
    const normalizedListingAmenities = new Set(
      listingAmenities.map((a) => a.toLowerCase().replace(/[^a-z0-9]+/g, "_")),
    );
    const hints = ROOM_AMENITY_HINTS[roomType] || [];
    const matchedHints = hints
      .filter((hint) => normalizedListingAmenities.has(hint))
      .slice(0, 2)
      .map(formatAmenityLabel);

    if (matchedHints.length > 0) {
      detailsParts.push(matchedHints.join(", "));
    }
  }

  return detailsParts.length > 0 ? detailsParts.join(" · ") : null;
}

/**
 * Airbnb-style adaptive layout partitioning.
 * Decomposes any photo count into balanced, harmonious blocks:
 * - 1 photo: single wide/balanced
 * - 2 photos: 2-column equal
 * - 3 photos: 1 large feature + 2 stacked
 * - 4 photos: 2x2 grid
 * - 5+ photos: feature blocks + 2-columns / 2x2 grids
 * Guarantees zero orphan photos and no awkward layout shifts.
 */
export function partitionPhotosIntoBlocks(photos: TourPhotoItem[]): LayoutBlock[] {
  const blocks: LayoutBlock[] = [];
  let index = 0;
  const count = photos.length;

  while (index < count) {
    const remaining = count - index;

    if (remaining === 1) {
      blocks.push({ type: "single", photo: photos[index] });
      index += 1;
    } else if (remaining === 2) {
      blocks.push({
        type: "two-column",
        photos: [photos[index], photos[index + 1]],
      });
      index += 2;
    } else if (remaining === 3) {
      const isAlt = blocks.filter((b) => b.type.startsWith("feature")).length % 2 === 1;
      if (isAlt) {
        blocks.push({
          type: "feature-left-stacked",
          stacked: [photos[index], photos[index + 1]],
          feature: photos[index + 2],
        });
      } else {
        blocks.push({
          type: "feature-right-stacked",
          feature: photos[index],
          stacked: [photos[index + 1], photos[index + 2]],
        });
      }
      index += 3;
    } else if (remaining === 4) {
      blocks.push({
        type: "two-by-two",
        photos: [photos[index], photos[index + 1], photos[index + 2], photos[index + 3]],
      });
      index += 4;
    } else {
      // remaining >= 5: take 3 as feature block so remaining is >= 2
      const isAlt = blocks.filter((b) => b.type.startsWith("feature")).length % 2 === 1;
      if (isAlt) {
        blocks.push({
          type: "feature-left-stacked",
          stacked: [photos[index], photos[index + 1]],
          feature: photos[index + 2],
        });
      } else {
        blocks.push({
          type: "feature-right-stacked",
          feature: photos[index],
          stacked: [photos[index + 1], photos[index + 2]],
        });
      }
      index += 3;
    }
  }

  return blocks;
}

export type BuildPhotoTourParams = {
  photos: string[];
  photoRoomAssignments?: PhotoRoomAssignment[];
  rooms?: RoomItemLike[];
  amenities?: string[];
  listingTitle?: string;
};

export function buildPhotoTourViewModel({
  photos = [],
  photoRoomAssignments = [],
  rooms = [],
  amenities = [],
  listingTitle,
}: BuildPhotoTourParams): PhotoTourViewModel {
  // Deduplicate and filter photos while strictly preserving index order
  const validPhotos: string[] = [];
  const seenUrls = new Set<string>();

  for (const p of photos) {
    if (typeof p === "string" && p.trim().length > 0 && !seenUrls.has(p)) {
      seenUrls.add(p);
      validPhotos.push(p);
    }
  }

  if (validPhotos.length === 0) {
    return {
      totalPhotos: 0,
      sections: [],
      allPhotos: [],
      photoByUrl: new Map(),
    };
  }

  // Build assignments map by URL
  const assignmentByUrl = new Map<string, PhotoRoomAssignment>();
  for (const a of photoRoomAssignments) {
    if (a && typeof a.url === "string" && seenUrls.has(a.url)) {
      assignmentByUrl.set(a.url, a);
    }
  }

  // Index rooms by id and normalized type
  const roomById = new Map<string, RoomItemLike>();
  const roomByType = new Map<string, RoomItemLike>();
  for (const r of rooms) {
    if (r && typeof r.id === "string") {
      roomById.set(r.id, r);
      if (typeof r.type === "string" && r.type.trim()) {
        const norm = resolvePhotoRoomType(r.type);
        if (norm && !roomByType.has(norm)) {
          roomByType.set(norm, r);
        }
      }
    }
  }

  // Check how many photos have assignments
  let assignedCount = 0;
  for (const url of validPhotos) {
    const a = assignmentByUrl.get(url);
    if (a && (a.roomInstanceId || a.roomType || a.roomCategory || a.categoryId)) {
      assignedCount++;
    }
  }

  // Case 1: No photos assigned to any rooms at all -> Single "All photos" collection
  if (assignedCount === 0) {
    const allItems: TourPhotoItem[] = validPhotos.map((url, idx) => ({
      id: `${idx}-${url}`,
      url,
      globalIndex: idx,
      roomIndex: idx,
      roomId: "all_photos",
      roomName: "All photos",
    }));

    const singleSection: TourRoomSection = {
      id: "all_photos",
      title: "All photos",
      roomType: "ALL",
      details: `${validPhotos.length} ${validPhotos.length === 1 ? "photo" : "photos"} of ${listingTitle || "this property"}`,
      photos: allItems,
      coverPhoto: allItems[0],
      blocks: partitionPhotosIntoBlocks(allItems),
    };

    const photoByUrl = new Map(allItems.map((p) => [p.url, p]));

    return {
      totalPhotos: validPhotos.length,
      sections: [singleSection],
      allPhotos: allItems,
      photoByUrl,
    };
  }

  // Case 2: Group photos by room
  // Group keys can be:
  // - roomInstanceId (if assigned to a specific room instance in `rooms`)
  // - roomType (e.g. LIVING_ROOM, KITCHEN, etc.)
  // - "unassigned" (for unassigned photos)

  type GroupData = {
    key: string;
    id: string;
    title: string;
    roomType: PhotoRoomType | "UNASSIGNED";
    roomItem?: RoomItemLike;
    urls: string[];
    firstAppearanceIndex: number;
  };

  const groups = new Map<string, GroupData>();
  const unassignedUrls: string[] = [];

  validPhotos.forEach((url, photoIndex) => {
    const assignment = assignmentByUrl.get(url);
    const instanceId = typeof assignment?.roomInstanceId === "string" ? assignment.roomInstanceId.trim() : null;
    const resolvedType = resolvePhotoRoomType(
      assignment?.roomType ?? assignment?.roomCategory ?? assignment?.categoryId ?? null,
    );

    if (instanceId && roomById.has(instanceId)) {
      const room = roomById.get(instanceId)!;
      const groupKey = `room_inst_${instanceId}`;
      if (!groups.has(groupKey)) {
        const typeResolved = resolvePhotoRoomType(room.type) || "OTHER_SPACE";
        const catConfig = PHOTO_TOUR_CATEGORIES.find((c) => c.id === typeResolved);
        groups.set(groupKey, {
          key: groupKey,
          id: groupKey,
          title: cleanCategoryLabel(room.name || catConfig?.label || "Room"),
          roomType: typeResolved,
          roomItem: room,
          urls: [],
          firstAppearanceIndex: photoIndex,
        });
      }
      groups.get(groupKey)!.urls.push(url);
    } else if (resolvedType && resolvedType !== "UNASSIGNED_PHOTOS") {
      const catConfig = PHOTO_TOUR_CATEGORIES.find((c) => c.id === resolvedType);
      const groupKey = `type_${resolvedType}`;
      if (!groups.has(groupKey)) {
        const roomItem = roomByType.get(resolvedType);
        const title = cleanCategoryLabel(
          assignment?.roomLabel?.trim() || roomItem?.name || catConfig?.label || formatAmenityLabel(resolvedType),
        );
        groups.set(groupKey, {
          key: groupKey,
          id: groupKey,
          title,
          roomType: resolvedType,
          roomItem,
          urls: [],
          firstAppearanceIndex: photoIndex,
        });
      }
      groups.get(groupKey)!.urls.push(url);
    } else {
      unassignedUrls.push(url);
    }
  });

  // Sort groups by the order their first photo appeared in the listing photos array
  // This guarantees the cover photo's room comes first!
  const sortedGroups = Array.from(groups.values()).sort(
    (a, b) => a.firstAppearanceIndex - b.firstAppearanceIndex,
  );

  // If there are unassigned photos, append them as "Additional photos"
  if (unassignedUrls.length > 0) {
    sortedGroups.push({
      key: "unassigned_photos",
      id: "unassigned_photos",
      title: "Additional photos",
      roomType: "UNASSIGNED",
      urls: unassignedUrls,
      firstAppearanceIndex: 999999,
    });
  }

  // Flatten and build TourPhotoItems with stable globalIndex matching original photos order
  const allPhotos: TourPhotoItem[] = [];
  const photoByUrl = new Map<string, TourPhotoItem>();

  // Global index tracking based on original validPhotos order
  const urlToGlobalIndex = new Map(validPhotos.map((url, idx) => [url, idx]));

  const sections: TourRoomSection[] = sortedGroups.map((group) => {
    const details = resolveRoomDetails(group.roomType, group.roomItem, amenities);

    const roomPhotos: TourPhotoItem[] = group.urls.map((url, roomIndex) => {
      const assignment = assignmentByUrl.get(url);
      const globalIndex = urlToGlobalIndex.get(url) ?? allPhotos.length;
      const item: TourPhotoItem = {
        id: `${group.id}-${roomIndex}-${url}`,
        url,
        globalIndex,
        roomIndex,
        roomId: group.id,
        roomName: group.title,
        caption: typeof assignment?.description === "string" ? assignment.description : null,
        sortOrder: typeof assignment?.sortOrder === "number" ? assignment.sortOrder : roomIndex,
      };
      photoByUrl.set(url, item);
      allPhotos.push(item);
      return item;
    });

    return {
      id: group.id,
      title: group.title,
      roomType: group.roomType,
      details,
      photos: roomPhotos,
      coverPhoto: roomPhotos[0],
      blocks: partitionPhotosIntoBlocks(roomPhotos),
    };
  });

  // Ensure allPhotos is ordered by globalIndex
  allPhotos.sort((a, b) => a.globalIndex - b.globalIndex);

  return {
    totalPhotos: validPhotos.length,
    sections,
    allPhotos,
    photoByUrl,
  };
}

