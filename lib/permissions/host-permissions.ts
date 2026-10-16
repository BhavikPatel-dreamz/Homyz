export interface HostPermissionCategory {
  id: string;
  name: string;
  description: string;
}

export const HOST_PERMISSION_CATEGORIES: HostPermissionCategory[] = [
  { id: "profile", name: "Profile", description: "Personal details and hosting profile management" },
  { id: "listings", name: "Listings", description: "Property listing creation, publishing, editing, and deletion" },
  { id: "bookings", name: "Bookings", description: "Guest reservations, acceptance, and cancellation controls" },
  { id: "calendar", name: "Calendar", description: "Property availability and blackout dates" },
  { id: "pricing", name: "Pricing", description: "Base pricing, discounts, and custom night rates" },
  { id: "earnings", name: "Earnings", description: "Financial earnings, payout settings, and tax records" },
  { id: "reviews", name: "Reviews", description: "Guest stay ratings and host review responses" },
];

export interface HostPermissionDefinition {
  slug: string;
  category: string;
  action: string;
  label: string;
  description: string;
  defaultEffect: "ALLOW" | "DENY";
}

export const ALL_HOST_PERMISSIONS: HostPermissionDefinition[] = [
  // Profile
  {
    slug: "profile.view",
    category: "profile",
    action: "View",
    label: "View Profile",
    description: "Access personal profile details and host settings",
    defaultEffect: "ALLOW",
  },
  {
    slug: "profile.edit",
    category: "profile",
    action: "Edit",
    label: "Edit Profile",
    description: "Update personal contact details, bio, and preferences",
    defaultEffect: "ALLOW",
  },

  // Listings
  {
    slug: "listing.create",
    category: "listings",
    action: "Create",
    label: "Create Listing",
    description: "Create new property listings on the platform",
    defaultEffect: "ALLOW",
  },
  {
    slug: "listing.view",
    category: "listings",
    action: "View",
    label: "View Listing",
    description: "View owned listing details, amenities, and photo gallery",
    defaultEffect: "ALLOW",
  },
  {
    slug: "listing.edit",
    category: "listings",
    action: "Edit",
    label: "Edit Listing",
    description: "Modify listing descriptions, rules, and amenities",
    defaultEffect: "ALLOW",
  },
  {
    slug: "listing.publish",
    category: "listings",
    action: "Publish",
    label: "Publish Listing",
    description: "Make property listings publicly visible and bookable",
    defaultEffect: "ALLOW",
  },
  {
    slug: "listing.unpublish",
    category: "listings",
    action: "Unpublish",
    label: "Unpublish Listing",
    description: "Hide active listings from public search results",
    defaultEffect: "ALLOW",
  },
  {
    slug: "listing.delete",
    category: "listings",
    action: "Delete",
    label: "Delete Listing",
    description: "Permanently remove draft or inactive listings",
    defaultEffect: "ALLOW",
  },

  // Bookings
  {
    slug: "booking.view",
    category: "bookings",
    action: "View",
    label: "View Bookings",
    description: "View guest reservation requests and history",
    defaultEffect: "ALLOW",
  },
  {
    slug: "booking.manage",
    category: "bookings",
    action: "Manage",
    label: "Manage Bookings",
    description: "Accept, confirm, or modify active guest bookings",
    defaultEffect: "ALLOW",
  },
  {
    slug: "booking.cancel",
    category: "bookings",
    action: "Cancel",
    label: "Cancel Booking",
    description: "Cancel confirmed or pending guest reservations",
    defaultEffect: "ALLOW",
  },

  // Calendar
  {
    slug: "calendar.view",
    category: "calendar",
    action: "View",
    label: "View Availability",
    description: "Inspect availability calendar and check-in dates",
    defaultEffect: "ALLOW",
  },
  {
    slug: "calendar.manage",
    category: "calendar",
    action: "Manage",
    label: "Manage Availability",
    description: "Block dates, update minimum stay, and open slots",
    defaultEffect: "ALLOW",
  },

  // Pricing
  {
    slug: "pricing.view",
    category: "pricing",
    action: "View",
    label: "View Pricing",
    description: "View base night rates and seasonal price rules",
    defaultEffect: "ALLOW",
  },
  {
    slug: "pricing.manage",
    category: "pricing",
    action: "Manage",
    label: "Manage Pricing",
    description: "Set nightly rates, weekend surcharges, and discounts",
    defaultEffect: "ALLOW",
  },

  // Earnings
  {
    slug: "earnings.view",
    category: "earnings",
    action: "View",
    label: "View Earnings",
    description: "View gross revenue, fee breakdowns, and financial reports",
    defaultEffect: "ALLOW",
  },
  {
    slug: "earnings.payout",
    category: "earnings",
    action: "Manage",
    label: "Manage Payouts",
    description: "Configure payout methods and trigger withdrawal requests",
    defaultEffect: "ALLOW",
  },

  // Reviews
  {
    slug: "reviews.view",
    category: "reviews",
    action: "View",
    label: "View Reviews",
    description: "Read guest reviews and ratings for hosted properties",
    defaultEffect: "ALLOW",
  },
  {
    slug: "reviews.respond",
    category: "reviews",
    action: "Respond",
    label: "Respond to Reviews",
    description: "Post public host responses to guest stay reviews",
    defaultEffect: "ALLOW",
  },
];

export type ThreeStateOverride = "INHERITED" | "ALLOW" | "DENY";
export type EffectiveState = "ALLOW" | "DENY";

export interface ResolvedHostPermission {
  slug: string;
  category: string;
  label: string;
  description: string;
  defaultEffect: EffectiveState;
  overrideEffect: ThreeStateOverride;
  effectiveEffect: EffectiveState;
  source: "INHERITED" | "EXPLICIT_ALLOW" | "EXPLICIT_DENY";
  sourceLabel: string;
}

export interface HostPermissionSummary {
  totalCount: number;
  inheritedCount: number;
  allowedOverridesCount: number;
  deniedOverridesCount: number;
  effectiveAllowedCount: number;
  effectiveDeniedCount: number;
}

export interface HostPermissionsResolution {
  hostId: string;
  hostName: string | null;
  hostEmail: string | null;
  hostStatus: string;
  isHostActive: boolean;
  permissions: ResolvedHostPermission[];
  summary: HostPermissionSummary;
}
