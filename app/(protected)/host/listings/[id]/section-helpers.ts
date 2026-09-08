export type SectionKey =
  | "title"
  | "propertyType"
  | "pricing"
  | "availability"
  | "guests"
  | "sleeping-arrangements"
  | "parking"
  | "safety-equipment"
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
  | "house-manual"
  | "checkout-instructions"
  | "check-out-instructions"
  | "checkout"
  | "check-out"
  | "checkout-page"
  | "check-out-page"
  | "checkoutpage"
  | "guidebooks"
  | "guidebook"
  | "interaction-preferences"
  | "interactionpreferences"
  | "listing-status"
  | "listingstatus"
  | "language"
  | "languages"
  | "guest-requirements"
  | "guestrequirements"
  | "local-laws"
  | "locallaws"
  | "regulations"
  | "taxes"
  | "homyz-stays"
  | "homyzstays"
  | "remove-listing"
  | "removelisting";

export const SECTION_SLUG_MAP: Record<string, SectionKey> = {
  "property-type": "propertyType",
  "propertytype": "propertyType",
  "propertyType": "propertyType",
  "title": "title",
  "description": "description",
  "pricing": "pricing",
  "availability": "availability",
  "guests": "guests",
  "sleeping-arrangements": "sleeping-arrangements",
  "sleepingarrangements": "sleeping-arrangements",
  "rooms": "sleeping-arrangements",
  "parking": "parking",
  "safety-equipment": "safety-equipment",
  "safetyequipment": "safety-equipment",
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
  "checkout-instructions": "checkout-instructions",
  "check-out-instructions": "checkout-instructions",
  "checkoutinstructions": "checkout-instructions",
  "checkout": "checkout-instructions",
  "check-out": "checkout-instructions",
  "checkout-page": "checkout-instructions",
  "check-out-page": "checkout-instructions",
  "checkoutpage": "checkout-instructions",
  "guidebooks": "guidebooks",
  "guidebook": "guidebooks",
  "interaction-preferences": "interaction-preferences",
  "interactionpreferences": "interaction-preferences",
  "listing-status": "listing-status",
  "listingstatus": "listing-status",
  "language": "language",
  "guest-requirements": "guest-requirements",
  "guestrequirements": "guest-requirements",
  "local-laws": "local-laws",
  "locallaws": "local-laws",
  "regulations": "regulations",
  "taxes": "taxes",
  "homyz-stays": "homyz-stays",
  "homyzstays": "homyz-stays",
  "remove-listing": "remove-listing",
  "removelisting": "remove-listing",
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
