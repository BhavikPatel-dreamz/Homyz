/**
 * Shared Google Maps Location Utility
 *
 * Generates official external Google Maps URLs using validated coordinates or
 * structured address fallbacks, respecting property privacy rules (showExactLocation).
 */

export interface LocationSource {
  id?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  showExactLocation?: boolean | null;
}

/**
 * Validates whether latitude and longitude are valid numeric geographic coordinates.
 *
 * Requirements:
 * - Must be finite numbers
 * - -90 <= latitude <= 90
 * - -180 <= longitude <= 180
 * - Rejects (0, 0) as it usually indicates uninitialized default/missing data
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return false;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }
  // Reject 0,0 (Null Island) as uninitialized/missing coordinate
  if (lat === 0 && lng === 0) {
    return false;
  }
  return true;
}

/**
 * Formats a valid coordinates query string for Google Maps.
 * Returns: "https://www.google.com/maps/search/?api=1&query={lat},{lng}"
 */
export function buildGoogleMapsCoordinateUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * Builds an official external Google Maps URL for a property.
 *
 * Priority:
 * 1. Valid coordinates (exact or approximate, as approved by backend DTO)
 * 2. Full street address (only when showExactLocation !== false)
 * 3. Structured location fallback (district, city, state, country)
 * 4. Returns `null` if no valid location exists (safe missing-location behavior)
 */
export function getGoogleMapsUrl(property: LocationSource | null | undefined): string | null {
  if (!property) return null;

  // 1. Preferred: Valid latitude + longitude
  if (
    typeof property.latitude === "number" &&
    typeof property.longitude === "number" &&
    isValidCoordinate(property.latitude, property.longitude)
  ) {
    return buildGoogleMapsCoordinateUrl(property.latitude, property.longitude);
  }

  // 2. Address fallback: Check if exact street address is permitted
  const allowExact = property.showExactLocation !== false;
  const addressParts: string[] = [];

  if (allowExact && property.address && property.address.trim().length > 0) {
    addressParts.push(property.address.trim());
  }

  if (property.district && property.district.trim().length > 0) {
    addressParts.push(property.district.trim());
  }

  if (property.city && property.city.trim().length > 0) {
    addressParts.push(property.city.trim());
  }

  if (property.state && property.state.trim().length > 0 && property.state !== property.city) {
    addressParts.push(property.state.trim());
  }

  if (property.country && property.country.trim().length > 0) {
    addressParts.push(property.country.trim());
  }

  if (addressParts.length > 0) {
    const query = addressParts.join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  return null;
}

/**
 * Optional lightweight client-side analytics tracker for Google Maps external clicks.
 * Safe: Sends only property ID, source, and destination type without sensitive user data.
 */
export function trackGoogleMapsOpen(
  propertyId?: string | null,
  source: "listing_marker_preview" | "property_details" | "property_card" = "listing_marker_preview",
  destinationType: "coordinates" | "address" = "coordinates"
): void {
  try {
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.sendBeacon) {
      const payload = JSON.stringify({
        event: "property_google_maps_open",
        propertyId: propertyId || null,
        source,
        destinationType,
        timestamp: Date.now(),
      });
      navigator.sendBeacon("/api/v1/search/track", payload);
    }
  } catch {
    // Non-blocking telemetry
  }
}
