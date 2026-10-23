import "server-only";

import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { getCache, setCache } from "@/lib/redis/cache";
import { hostListingPerformanceService } from "@/services/host-listing-performance.service";

export type OpportunityCategory =
  | "ALL"
  | "HEALTH"
  | "PHOTOS"
  | "AMENITIES"
  | "FAMILY"
  | "WORKSPACE"
  | "SETTINGS"
  | "PRICING"
  | "CALENDAR"
  | "DETAILS"
  | "POLICIES"
  | "REVIEWS";

export type OpportunityPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface HostOpportunityItem {
  id: string;
  listingId: string;
  listingTitle: string;
  category: OpportunityCategory;
  priority: OpportunityPriority;
  impact: "High" | "Medium" | "Low";
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  currentValueDescription?: string;
  recommendedChangeDescription?: string;
  dismissible: boolean;
  status: "AVAILABLE" | "COMPLETED" | "DISMISSED";
}

export interface ListingHealthCheckItem {
  id: string;
  label: string;
  isComplete: boolean;
  actionHref: string;
}

export interface ListingHealthSummary {
  listingId: string;
  title: string;
  completenessPercentage: number;
  completedChecksCount: number;
  totalChecksCount: number;
  checks: ListingHealthCheckItem[];
  missingCount: number;
}

export interface HostOpportunitiesOverviewData {
  selectedListingId: string | null;
  listings: Array<{ id: string; title: string }>;
  overallHealth: {
    averageCompletenessPercentage: number;
    completedChecksCount: number;
    totalChecksCount: number;
    listingsHealth: ListingHealthSummary[];
  };
  opportunities: {
    items: HostOpportunityItem[];
    totalCount: number;
    countsByCategory: Record<OpportunityCategory, number>;
  };
}

const DISMISS_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

export const hostOpportunitiesService = {
  /**
   * Evaluates deterministic, non-AI opportunities and listing health for host listings.
   */
  async getOpportunitiesOverview(
    actor: AuthUser,
    options: { listingId?: string | null } = {},
  ): Promise<HostOpportunitiesOverviewData> {
    const listings = await prisma.listing.findMany({
      where: {
        hostId: actor.id,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        address: true,
        city: true,
        country: true,
        guests: true,
        bedrooms: true,
        beds: true,
        bathrooms: true,
        photos: true,
        amenities: true,
        houseRules: true,
        additionalRules: true,
        quietHours: true,
        rooms: true,
        price: true,
        weekdayBasePrice: true,
        weekendPrice: true,
        discounts: true,
        minNights: true,
        maxNights: true,
        cancellationPolicy: true,
        bookingApprovalMode: true,
        instantBook: true,
        isPaused: true,
        published: true,
        status: true,
        checkInInstructions: true,
        checkInMethod: true,
        childrenAllowed: true,
        infantsAllowed: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const hostListingList = listings.map((l) => ({ id: l.id, title: l.title }));
    if (options.listingId && !listings.some((listing) => listing.id === options.listingId)) {
      throw AppError.forbidden("You do not have access to this listing.");
    }
    const scopedListings = options.listingId
      ? listings.filter((l) => l.id === options.listingId)
      : listings;

    const listingsHealth: ListingHealthSummary[] = [];
    const opportunities: HostOpportunityItem[] = [];

    let totalCompleted = 0;
    let totalChecks = 0;

    for (const listing of scopedListings) {
      const amenitiesLower = listing.amenities.map((a) => a.toLowerCase());
      const discountsObj =
        typeof listing.discounts === "object" && listing.discounts !== null
          ? (listing.discounts as Record<string, unknown>)
          : {};

      // 14 Deterministic Listing Health Checks
      const checks: ListingHealthCheckItem[] = [
        {
          id: "title",
          label: "Listing title",
          isComplete: Boolean(listing.title?.trim()),
          actionHref: `/host/listings/${listing.id}/title`,
        },
        {
          id: "description",
          label: "Property description",
          isComplete: Boolean(listing.description?.trim()),
          actionHref: `/host/listings/${listing.id}/description`,
        },
        {
          id: "address",
          label: "Address & location",
          isComplete: Boolean(listing.address?.trim() && listing.city?.trim() && listing.country?.trim()),
          actionHref: `/host/listings/${listing.id}/location`,
        },
        {
          id: "capacity",
          label: "Guest capacity & beds",
          isComplete: Boolean(listing.guests > 0 && listing.beds > 0 && listing.bathrooms > 0),
          actionHref: `/host/listings/${listing.id}/propertyType`,
        },
        {
          id: "amenities",
          label: "Core amenities (at least 5)",
          isComplete: listing.amenities.length >= 5,
          actionHref: `/host/listings/${listing.id}/amenities`,
        },
        {
          id: "photos",
          label: "Photo gallery (at least 5)",
          isComplete: listing.photos.length >= 5,
          actionHref: `/host/listings/${listing.id}/photos`,
        },
        {
          id: "cover_photo",
          label: "Cover photo set",
          isComplete: listing.photos.length > 0,
          actionHref: `/host/listings/${listing.id}/photos`,
        },
        {
          id: "rooms",
          label: "Sleeping arrangements",
          isComplete: Boolean(listing.rooms),
          actionHref: `/host/listings/${listing.id}/sleeping-arrangements`,
        },
        {
          id: "pricing",
          label: "Nightly rate configured",
          isComplete: (listing.weekdayBasePrice ?? listing.price) > 0,
          actionHref: `/host/listings/${listing.id}/pricing`,
        },
        {
          id: "availability",
          label: "Calendar availability open",
          isComplete: !listing.isPaused && listing.maxNights >= listing.minNights,
          actionHref: `/host/calendar?listingId=${encodeURIComponent(listing.id)}`,
        },
        {
          id: "house_rules",
          label: "House rules completed",
          isComplete: Boolean(
            listing.houseRules.length > 0 || listing.additionalRules || listing.quietHours !== null,
          ),
          actionHref: `/host/listings/${listing.id}/house-rules`,
        },
        {
          id: "booking_settings",
          label: "Booking settings & cancellation policy",
          isComplete: Boolean(listing.cancellationPolicy && listing.bookingApprovalMode),
          actionHref: `/host/listings/${listing.id}/booking-settings`,
        },
        {
          id: "checkin_guide",
          label: "Arrival & check-in guide",
          isComplete: Boolean(listing.checkInInstructions?.trim() || listing.checkInMethod),
          actionHref: `/host/listings/${listing.id}/check-in-out`,
        },
        {
          id: "published_status",
          label: "Published & active",
          isComplete: Boolean(listing.published && listing.status === "ACTIVE"),
          actionHref: `/host/listings/${listing.id}/listing-status`,
        },
      ];

      const completedCount = checks.filter((c) => c.isComplete).length;
      totalCompleted += completedCount;
      totalChecks += checks.length;

      listingsHealth.push({
        listingId: listing.id,
        title: listing.title,
        completenessPercentage: Math.round((completedCount / checks.length) * 100),
        completedChecksCount: completedCount,
        totalChecksCount: checks.length,
        checks,
        missingCount: checks.length - completedCount,
      });

      // ── Category 1: Photos Management ──
      if (listing.photos.length === 0) {
        opportunities.push({
          id: `photos-none-${listing.id}`,
          listingId: listing.id,
          listingTitle: listing.title,
          category: "PHOTOS",
          priority: "CRITICAL",
          impact: "High",
          title: "Upload listing photos",
          description: `Your property "${listing.title}" currently has no photos. Properties require at least 5 photos to go live.`,
          actionLabel: "Manage Photos",
          actionHref: `/host/listings/${listing.id}/photos`,
          currentValueDescription: "0 photos uploaded",
          recommendedChangeDescription: "Add 5 or more high-resolution photos",
          dismissible: false,
          status: "AVAILABLE",
        });
      } else if (listing.photos.length < 5) {
        opportunities.push({
          id: `photos-few-${listing.id}`,
          listingId: listing.id,
          listingTitle: listing.title,
          category: "PHOTOS",
          priority: "HIGH",
          impact: "High",
          title: "Improve listing photo gallery",
          description: `"${listing.title}" currently has ${listing.photos.length} photo${
            listing.photos.length === 1 ? "" : "s"
          }. Add enough photos for guests to review the space before booking.`,
          actionLabel: "Manage Photos",
          actionHref: `/host/listings/${listing.id}/photos`,
          currentValueDescription: `${listing.photos.length} photos`,
          recommendedChangeDescription: "Reach 5+ photos covering bedroom, bathroom, and living areas",
          dismissible: true,
          status: "AVAILABLE",
        });
      }

      // ── Category 2: Popular Amenities ──
      const hasWifi = amenitiesLower.some((a) => a.includes("wifi") || a.includes("wi-fi") || a.includes("internet"));
      if (!hasWifi) {
        opportunities.push({
          id: `amenity-wifi-${listing.id}`,
          listingId: listing.id,
          listingTitle: listing.title,
          category: "AMENITIES",
          priority: "HIGH",
          impact: "High",
          title: "Add Wi-Fi amenity",
          description: `If "${listing.title}" offers Wi-Fi, add it to the listing details so guests can make an informed choice.`,
          actionLabel: "Manage Amenities",
          actionHref: `/host/listings/${listing.id}/amenities`,
          currentValueDescription: "Wi-Fi not listed",
          recommendedChangeDescription: "Confirm Wi-Fi availability and network details",
          dismissible: true,
          status: "AVAILABLE",
        });
      }

      const hasAc = amenitiesLower.some((a) => a.includes("air conditioning") || a.includes("ac") || a.includes("a/c"));
      if (!hasAc) {
        opportunities.push({
          id: `amenity-ac-${listing.id}`,
          listingId: listing.id,
          listingTitle: listing.title,
          category: "AMENITIES",
          priority: "MEDIUM",
          impact: "Medium",
          title: "Add Air conditioning",
          description: `If "${listing.title}" offers air conditioning, add it to the listing amenities.`,
          actionLabel: "Manage Amenities",
          actionHref: `/host/listings/${listing.id}/amenities`,
          dismissible: true,
          status: "AVAILABLE",
        });
      }

      // ── Category 3: Family-Friendly Amenities ──
      if (listing.guests >= 3 || listing.childrenAllowed === true || listing.infantsAllowed === true) {
        const hasCrib = amenitiesLower.some((a) => a.includes("crib") || a.includes("high chair") || a.includes("baby"));
        if (!hasCrib) {
          opportunities.push({
            id: `family-amenities-${listing.id}`,
            listingId: listing.id,
            listingTitle: listing.title,
            category: "FAMILY",
            priority: "MEDIUM",
            impact: "Medium",
            title: "Make your space family-friendly",
            description: `"${listing.title}" accommodates ${listing.guests} guests. If suitable amenities are available, list them accurately for families.`,
            actionLabel: "Review Family Amenities",
            actionHref: `/host/listings/${listing.id}/amenities`,
            dismissible: true,
            status: "AVAILABLE",
          });
        }
      }

      // ── Category 4: Remote Workspace ──
      const hasWorkspace = amenitiesLower.some(
        (a) => a.includes("workspace") || a.includes("desk") || a.includes("dedicated workspace"),
      );
      if (!hasWorkspace) {
        opportunities.push({
          id: `workspace-${listing.id}`,
          listingId: listing.id,
          listingTitle: listing.title,
          category: "WORKSPACE",
          priority: "MEDIUM",
          impact: "Medium",
          title: "Make your space work-friendly",
          description: `If "${listing.title}" has a usable desk and chair, add the workspace amenity accurately.`,
          actionLabel: "Update Workspace Amenities",
          actionHref: `/host/listings/${listing.id}/amenities`,
          dismissible: true,
          status: "AVAILABLE",
        });
      }

      // ── Category 5: Flexible Stays & Booking Settings ──
      if (listing.minNights > 3) {
        opportunities.push({
          id: `settings-minstay-${listing.id}`,
          listingId: listing.id,
          listingTitle: listing.title,
          category: "SETTINGS",
          priority: "MEDIUM",
          impact: "Medium",
          title: "Allow shorter minimum stays",
          description: `Your minimum stay is set to ${listing.minNights} nights on "${listing.title}". Review whether this still fits your availability and hosting policy.`,
          actionLabel: "Review Booking Settings",
          actionHref: `/host/listings/${listing.id}/booking-settings`,
          currentValueDescription: `${listing.minNights} nights minimum`,
          recommendedChangeDescription: "Review the minimum-stay policy",
          dismissible: true,
          status: "AVAILABLE",
        });
      }

      if (listing.cancellationPolicy === "STRICT") {
        opportunities.push({
          id: `settings-cancel-${listing.id}`,
          listingId: listing.id,
          listingTitle: listing.title,
          category: "SETTINGS",
          priority: "LOW",
          impact: "Low",
          title: "Review cancellation policy",
          description: `"${listing.title}" uses a Strict cancellation policy. Review whether it matches the terms you intend to offer guests.`,
          actionLabel: "Review Cancellation Policy",
          actionHref: `/host/listings/${listing.id}/cancellation-policy`,
          dismissible: true,
          status: "AVAILABLE",
        });
      }

      // ── Category 6: Longer-Stay Discounts ──
      const weeklyDiscount = Number(discountsObj.weekly) || 0;
      if (weeklyDiscount === 0) {
        opportunities.push({
          id: `pricing-weekly-${listing.id}`,
          listingId: listing.id,
          listingTitle: listing.title,
          category: "PRICING",
          priority: "MEDIUM",
          impact: "Medium",
          title: "Add a weekly stay discount",
          description: `No weekly discount is configured for "${listing.title}". Review whether a voluntary length-of-stay discount fits your pricing strategy.`,
          actionLabel: "Manage Length-of-Stay Discounts",
          actionHref: `/host/listings/${listing.id}/pricing`,
          currentValueDescription: "No weekly discount configured",
          recommendedChangeDescription: "Review weekly discount settings",
          dismissible: true,
          status: "AVAILABLE",
        });
      }

      const monthlyDiscount = Number(discountsObj.monthly) || 0;
      if (monthlyDiscount === 0) {
        opportunities.push({
          id: `pricing-monthly-${listing.id}`,
          listingId: listing.id,
          listingTitle: listing.title,
          category: "PRICING",
          priority: "LOW",
          impact: "Medium",
          title: "Add a monthly stay discount",
          description: `No monthly discount is configured for "${listing.title}". Review whether a voluntary length-of-stay discount fits your pricing strategy.`,
          actionLabel: "Manage Length-of-Stay Discounts",
          actionHref: `/host/listings/${listing.id}/pricing`,
          dismissible: true,
          status: "AVAILABLE",
        });
      }

      // ── Category 7: Calendar & Check-in Details ──
      if (!listing.checkInInstructions?.trim()) {
        opportunities.push({
          id: `calendar-checkin-${listing.id}`,
          listingId: listing.id,
          listingTitle: listing.title,
          category: "CALENDAR",
          priority: "HIGH",
          impact: "High",
          title: "Add arrival check-in instructions",
          description: `Add accurate arrival instructions for "${listing.title}" so confirmed guests can prepare for check-in.`,
          actionLabel: "Add Check-in Guide",
          actionHref: `/host/listings/${listing.id}/check-in-out`,
          dismissible: true,
          status: "AVAILABLE",
        });
      }
    }

    // Peer-comparison suggestions require a deliberately selected listing. This
    // avoids bulk automated searches while keeping every recommendation backed
    // by the same live Homyz data shown in Listing Performance.
    if (options.listingId) {
      const performance = await hostListingPerformanceService.getListingPerformance(actor, { listingId: options.listingId });
      for (const fix of performance?.quickFixes ?? []) {
        opportunities.push({
          id: fix.id,
          listingId: performance!.listing.id,
          listingTitle: performance!.listing.title,
          category: fix.category,
          priority: fix.priority,
          impact: fix.priority === "HIGH" ? "High" : "Medium",
          title: fix.title,
          description: fix.description,
          actionLabel: fix.actionLabel,
          actionHref: fix.actionHref,
          currentValueDescription: fix.currentValueDescription,
          recommendedChangeDescription: fix.recommendedChangeDescription,
          dismissible: true,
          status: "AVAILABLE",
        });
      }
    }

    // Filter out dismissed opportunities from active list
    const activeOpportunities: HostOpportunityItem[] = [];
    for (const opp of opportunities) {
      const dismissKey = `homyz:opp:dismissed:${actor.id}:${opp.listingId}:${opp.id}`;
      const isDismissed = await getCache<boolean>(dismissKey);
      if (!isDismissed) {
        activeOpportunities.push(opp);
      }
    }

    // Sort opportunities: CRITICAL -> HIGH -> MEDIUM -> LOW
    const priorityWeight: Record<OpportunityPriority, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };
    activeOpportunities.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    const countsByCategory: Record<OpportunityCategory, number> = {
      ALL: activeOpportunities.length,
      HEALTH: 0,
      PHOTOS: activeOpportunities.filter((o) => o.category === "PHOTOS").length,
      AMENITIES: activeOpportunities.filter((o) => o.category === "AMENITIES").length,
      FAMILY: activeOpportunities.filter((o) => o.category === "FAMILY").length,
      WORKSPACE: activeOpportunities.filter((o) => o.category === "WORKSPACE").length,
      SETTINGS: activeOpportunities.filter((o) => o.category === "SETTINGS").length,
      PRICING: activeOpportunities.filter((o) => o.category === "PRICING").length,
      CALENDAR: activeOpportunities.filter((o) => o.category === "CALENDAR").length,
      DETAILS: activeOpportunities.filter((o) => o.category === "DETAILS").length,
      POLICIES: activeOpportunities.filter((o) => o.category === "POLICIES").length,
      REVIEWS: activeOpportunities.filter((o) => o.category === "REVIEWS").length,
    };

    const avgCompleteness =
      totalChecks > 0 ? Math.round((totalCompleted / totalChecks) * 100) : 100;

    return {
      selectedListingId: options.listingId || null,
      listings: hostListingList,
      overallHealth: {
        averageCompletenessPercentage: avgCompleteness,
        completedChecksCount: totalCompleted,
        totalChecksCount: totalChecks,
        listingsHealth,
      },
      opportunities: {
        items: activeOpportunities,
        totalCount: activeOpportunities.length,
        countsByCategory,
      },
    };
  },

  /**
   * Dismisses a non-mandatory opportunity for a specific listing.
   */
  async dismissOpportunity(hostId: string, opportunityId: string, listingId: string) {
    if (!hostId || !opportunityId || !listingId) {
      throw AppError.validation("Invalid opportunity dismissal parameters.");
    }

    const host = await prisma.user.findUnique({
      where: { id: hostId },
      select: { id: true, role: true, email: true },
    });
    if (!host) {
      throw AppError.forbidden("Access denied for this listing.");
    }

    const overview = await this.getOpportunitiesOverview(host, { listingId });
    const opportunity = overview.opportunities.items.find((item) => item.id === opportunityId);
    if (!opportunity) throw AppError.notFound("This opportunity is no longer available.");
    if (!opportunity.dismissible) throw AppError.forbidden("This required opportunity cannot be dismissed.");

    const dismissKey = `homyz:opp:dismissed:${hostId}:${listingId}:${opportunityId}`;
    await setCache(dismissKey, true, DISMISS_TTL_SECONDS);

    return { success: true, opportunityId, listingId };
  },
};
