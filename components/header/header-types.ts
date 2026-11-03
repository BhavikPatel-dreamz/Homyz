export interface SuggestionLocationItem {
  id?: string;
  name: string;
  city: string;
  fullLabel: string;
  state?: string | null;
  region?: string | null;
  country: string | null;
  countryCode?: string | null;
  locality?: string | null;
  latitude: number;
  longitude: number;
  subtitle?: string;
  badge?: string;
  locationType: string;
  providerPlaceId: string;
  type?: string;
  distanceKm?: number;
}

export interface SelectedLocationData {
  name: string;
  fullAddress: string;
  city: string;
  state?: string;
  country: string;
  locality?: string;
  latitude: number;
  longitude: number;
  locationType: string;
  providerPlaceId: string;
}

export interface GuestCounts {
  adults: number;
  children: number;
  infants: number;
  pets: number;
}

export interface DatePreferences {
  mode: "dates" | "flexible";
  tolerance: number; // 0 (exact), 1 (±1 day), 2 (±2 days), 3 (±3 days), 7 (±7 days)
  stay: "Weekend" | "Week" | "Month";
  months: string[]; // YYYY-MM
}

export type SearchFieldTab = "where" | "when" | "who";

export interface RecentSearchItem {
  id: string;
  displayName: string;
  city?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  locationType?: string | null;
}

