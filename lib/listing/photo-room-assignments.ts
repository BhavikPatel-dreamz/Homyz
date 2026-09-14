export const PHOTO_ROOM_TYPES = [
  "LIVING_ROOM",
  "BEDROOM",
  "BATHROOM",
  "KITCHEN",
  "DINING_AREA",
  "WORKSPACE",
  "ENTRANCE",
  "EXTERIOR",
  "PATIO_BALCONY",
  "POOL_HOT_TUB",
  "LAUNDRY",
  "VIEW",
  "PARKING",
  "OTHER",
] as const;

export type PhotoRoomType = (typeof PHOTO_ROOM_TYPES)[number];

export type PhotoRoomAssignment = {
  url: string;
  roomType: PhotoRoomType | null;
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
    const { url, roomType } = entry as { url?: unknown; roomType?: unknown };
    if (typeof url !== "string" || !photoUrls.has(url) || seen.has(url) || !isPhotoRoomType(roomType)) {
      return [];
    }
    seen.add(url);
    return [{ url, roomType }];
  });
}
