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
  | "homyz-org-stays"
  | "airbnb-org-stays"
  | "airbnb-stays"
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
  "homyz-org-stays": "homyz-org-stays",
  "homyzorgstays": "homyz-org-stays",
  "airbnb-org-stays": "airbnb-org-stays",
  "airbnb-stays": "airbnb-org-stays",
  "airbnborgstays": "airbnb-org-stays",
  "airbnbstays": "airbnb-org-stays",
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

export function formatTimeDisplay(time: string | null | undefined, defaultVal = ""): string {
  if (!time) return defaultVal;
  const trimmed = time.trim();
  if (!trimmed) return defaultVal;
  if (/flexible/i.test(trimmed)) return "Flexible";

  // Check 12-hour format: e.g. "3:00 PM", "3:00 pm", "11:00pm", "11 pm"
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    const hour = parseInt(match12[1], 10);
    const min = match12[2] || "00";
    const period = match12[3].toLowerCase();
    return `${hour}:${min} ${period}`;
  }

  // Check 24-hour format: e.g. "15:00", "07:00", "22:30", "9:00"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let hour = parseInt(match24[1], 10);
    const min = match24[2];
    const period = hour >= 12 ? "pm" : "am";
    hour = hour % 12 || 12;
    return `${hour}:${min} ${period}`;
  }

  return trimmed;
}

export const ALL_HOURS_OPTIONS = [
  "12:00 am",
  "1:00 am",
  "2:00 am",
  "3:00 am",
  "4:00 am",
  "5:00 am",
  "6:00 am",
  "7:00 am",
  "8:00 am",
  "9:00 am",
  "10:00 am",
  "11:00 am",
  "12:00 pm",
  "1:00 pm",
  "2:00 pm",
  "3:00 pm",
  "4:00 pm",
  "5:00 pm",
  "6:00 pm",
  "7:00 pm",
  "8:00 pm",
  "9:00 pm",
  "10:00 pm",
  "11:00 pm",
];

export const QUIET_HOURS_START_OPTIONS = ALL_HOURS_OPTIONS;
export const QUIET_HOURS_END_OPTIONS = ALL_HOURS_OPTIONS;
export const CHECK_IN_TIMES = ALL_HOURS_OPTIONS;
export const CHECK_OUT_TIMES = ALL_HOURS_OPTIONS;
