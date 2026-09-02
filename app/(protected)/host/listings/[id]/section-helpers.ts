export type SectionKey =
  | "title"
  | "propertyType"
  | "pricing"
  | "availability"
  | "guests"
  | "description"
  | "amenities"
  | "add-amenities"
  | "photos"
  | "accessibility"
  | "location"
  | "arrival-guide"
  | "about-host"
  | "co-host"
  | "booking-settings"
  | "house-rules"
  | "guests-safety"
  | "cancellation-policy"
  | "custom-link"
  | "directions"
  | "check-in-out"
  | "check-in-method"
  | "wifi-details"
  | "house-manual";

const SECTION_SLUG_MAP: Record<string, SectionKey> = {
  "property-type": "propertyType",
  "propertytype": "propertyType",
  "propertyType": "propertyType",
  "title": "title",
  "description": "description",
  "pricing": "pricing",
  "availability": "availability",
  "guests": "guests",
  "amenities": "amenities",
  "add-amenities": "add-amenities",
  "photos": "photos",
  "accessibility": "accessibility",
  "location": "location",
  "arrival-guide": "arrival-guide",
  "arrival": "arrival-guide",
  "about-host": "about-host",
  "abouthost": "about-host",
  "co-host": "co-host",
  "cohost": "co-host",
  "booking-settings": "booking-settings",
  "bookingsettings": "booking-settings",
  "house-rules": "house-rules",
  "houserules": "house-rules",
  "guests-safety": "guests-safety",
  "guestssafety": "guests-safety",
  "safety": "guests-safety",
  "cancellation-policy": "cancellation-policy",
  "cancellationpolicy": "cancellation-policy",
  "custom-link": "custom-link",
  "customlink": "custom-link",
  "directions": "directions",
  "check-in-out": "check-in-out",
  "check-in-method": "check-in-method",
  "checkinmethod": "check-in-method",
  "wifi-details": "wifi-details",
  "wifidetails": "wifi-details",
  "house-manual": "house-manual",
  "housemanual": "house-manual",
};

export function sectionToSlug(section: SectionKey): string {
  if (section === "propertyType") return "property-type";
  return section;
}

export function slugToSection(slug?: string): SectionKey {
  if (!slug) return "propertyType";
  const normalized = slug.toLowerCase();
  return SECTION_SLUG_MAP[normalized] || SECTION_SLUG_MAP[slug] || "propertyType";
}
