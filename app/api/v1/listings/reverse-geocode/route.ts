import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { reverseGeocodeCoords } from "@/lib/location/places-provider";
import { getCache, setCache } from "@/lib/redis/cache";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/listings/reverse-geocode?lat=25.2048&lng=55.2708
 * Reverse-geocodes user coordinates into human-readable destination and address details.
 */
export const GET = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");

  if (!latStr || !lngStr) {
    throw AppError.badRequest("Missing lat or lng query parameters");
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    throw AppError.badRequest("Invalid lat or lng values");
  }

  const cacheKey = `homyz:loc:reverse:${lat.toFixed(4)}:${lng.toFixed(4)}`;
  try {
    const cached = await getCache<any>(cacheKey);
    if (cached) return ok(cached);
  } catch {}

  const result = await reverseGeocodeCoords(lat, lng);
  const payload =
    result || {
      id: `gps_${lat.toFixed(4)}_${lng.toFixed(4)}`,
      name: "Nearby stays",
      city: "Nearby",
      country: "",
      latitude: lat,
      longitude: lng,
      locationType: "current_location",
      providerPlaceId: `gps:${lat.toFixed(4)},${lng.toFixed(4)}`,
    };

  try {
    await setCache(cacheKey, payload, 86400 * 7); // 7 days TTL for reverse geocoding
  } catch {}

  return ok(payload);
});
