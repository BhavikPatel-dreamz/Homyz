/**
 * Listing Analytics & Telemetry Utility
 * Dispatches non-blocking events to /api/v1/search/track and emits
 * browser custom events for heatmap / third-party analytics integrations.
 */

export type ListingEventType =
  | "listing_page_view"
  | "listing_search"
  | "listing_filter_applied"
  | "listing_sort_changed"
  | "property_card_view"
  | "property_card_click"
  | "favorite_add"
  | "favorite_remove"
  | "map_marker_click"
  | "map_pan"
  | "map_zoom"
  | "map_area_search"
  | "load_more"
  | "listing_no_results"
  | "gallery_opened"
  | "gallery_photo_changed"
  | "wishlist_toggled"
  | "date_picker_opened"
  | "checkin_selected"
  | "checkout_selected"
  | "dates_cleared"
  | "guest_selector_opened"
  | "guest_count_changed"
  | "availability_conflict"
  | "quote_calculated"
  | "reserve_clicked"
  | "reserve_validation_failed"
  | "booking_flow_started"
  | "host_profile_clicked"
  | "contact_host_clicked"
  | "amenities_opened"
  | "description_expanded"
  | "description_collapsed"
  | "share_clicked"
  | "availability_section_viewed"
  | "house_rules_viewed"
  | "reviews_opened"
  | "map_interacted";

export interface ListingAnalyticsPayload {
  eventType: ListingEventType;
  destination?: string | null;
  city?: string | null;
  country?: string | null;
  placeName?: string | null;
  lat?: number | null;
  lng?: number | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guestCount?: number;
  resultCount?: number;
  propertyId?: string | null;
  filterKey?: string | null;
  sortOption?: string | null;
  metadata?: Record<string, unknown>;
}

export function trackListingEvent(payload: ListingAnalyticsPayload): void {
  if (typeof window === "undefined") return;

  const eventData = {
    ...payload,
    timestamp: new Date().toISOString(),
  };

  // 1. Dispatch custom DOM event for heatmap/session monitoring (Hotjar, clarity, etc.)
  try {
    window.dispatchEvent(
      new CustomEvent("homyz:analytics", {
        detail: eventData,
      }),
    );
  } catch {}

  // 2. Fire-and-forget telemetry request to backend analytics endpoint
  try {
    fetch("/api/v1/search/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
      keepalive: true,
    }).catch(() => {
      // Telemetry failures must never break the user experience
    });
  } catch {}
}

