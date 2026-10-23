import "server-only";

import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { hostListingPerformanceService } from "@/services/host-listing-performance.service";

export type OpportunityCategory = "ALL" | "PRICING_AVAILABILITY" | "LISTING_QUALITY" | "REVIEWS_GUEST_EXPERIENCE" | "SEARCH_CONVERSION" | "COMPETITOR_UPDATES";
export type OpportunityPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type OpportunityStatus = "ACTIVE" | "SNOOZED" | "DISMISSED" | "RESOLVED" | "EXPIRED";
export type OpportunitySort = "PRIORITY" | "RECENT" | "LISTING" | "CATEGORY";

export interface HostOpportunityItem {
  id: string;
  ruleKey: string;
  deduplicationKey: string;
  evidenceFingerprint: string;
  listingId: string;
  listingTitle: string;
  category: OpportunityCategory;
  priority: OpportunityPriority;
  title: string;
  description: string;
  evidence: string;
  actionLabel: string;
  actionHref: string;
  dismissible: boolean;
  status: OpportunityStatus;
  detectedAt: string;
  snoozedUntil?: string | null;
}

export interface HostOpportunitiesOverviewData {
  selectedListingId: string | null;
  listings: Array<{ id: string; title: string }>;
  summary: { activeCount: number; highPriorityCount: number; listingsNeedingAttentionCount: number; resolvedCount: number };
  topPriorities: HostOpportunityItem[];
  opportunities: {
    items: HostOpportunityItem[]; totalCount: number; page: number; pageSize: number; totalPages: number;
    countsByCategory: Record<OpportunityCategory, number>;
  };
}

export type OpportunityQueryOptions = {
  listingId?: string | null; category?: OpportunityCategory; priority?: OpportunityPriority;
  status?: OpportunityStatus; sort?: OpportunitySort; page?: number; pageSize?: number;
};

const priorityWeight: Record<OpportunityPriority, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const categoryForQuickFix: Record<"PRICING" | "AMENITIES" | "REVIEWS", OpportunityCategory> = {
  PRICING: "PRICING_AVAILABILITY", AMENITIES: "LISTING_QUALITY", REVIEWS: "REVIEWS_GUEST_EXPERIENCE",
};

function fingerprint(...parts: Array<string | number | boolean | null | undefined>) { return parts.map((part) => String(part ?? "")).join("|"); }
function emptyCounts(): Record<OpportunityCategory, number> {
  return { ALL: 0, PRICING_AVAILABILITY: 0, LISTING_QUALITY: 0, REVIEWS_GUEST_EXPERIENCE: 0, SEARCH_CONVERSION: 0, COMPETITOR_UPDATES: 0 };
}
function stableSort(items: HostOpportunityItem[], sort: OpportunitySort) {
  return [...items].sort((left, right) => {
    if (sort === "LISTING") return left.listingTitle.localeCompare(right.listingTitle) || left.id.localeCompare(right.id);
    if (sort === "CATEGORY") return left.category.localeCompare(right.category) || priorityWeight[right.priority] - priorityWeight[left.priority] || left.id.localeCompare(right.id);
    if (sort === "RECENT") return right.detectedAt.localeCompare(left.detectedAt) || priorityWeight[right.priority] - priorityWeight[left.priority] || left.id.localeCompare(right.id);
    return priorityWeight[right.priority] - priorityWeight[left.priority] || right.detectedAt.localeCompare(left.detectedAt) || left.id.localeCompare(right.id);
  });
}
function snapshotItem(value: unknown): HostOpportunityItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<HostOpportunityItem>;
  if (!item.id || !item.ruleKey || !item.listingId || !item.title || !item.actionHref || !item.category || !item.priority) return null;
  return { id: item.id, ruleKey: item.ruleKey, deduplicationKey: item.deduplicationKey || `${item.listingId}:${item.ruleKey}`, evidenceFingerprint: item.evidenceFingerprint || "historical", listingId: item.listingId, listingTitle: item.listingTitle || "Listing", category: item.category, priority: item.priority, title: item.title, description: item.description || "This opportunity is retained for your history.", evidence: item.evidence || "Recorded opportunity", actionLabel: item.actionLabel || "View listing", actionHref: item.actionHref, dismissible: Boolean(item.dismissible), status: item.status || "DISMISSED", detectedAt: item.detectedAt || new Date(0).toISOString(), snoozedUntil: item.snoozedUntil };
}

export const hostOpportunitiesService = {
  /** Rule evaluation is deterministic and read-only; lifecycle rows are only changed by explicit host actions. */
  async getOpportunitiesOverview(actor: AuthUser, options: OpportunityQueryOptions = {}): Promise<HostOpportunitiesOverviewData> {
    const listings = await prisma.listing.findMany({
      where: { hostId: actor.id, deletedAt: null },
      select: { id: true, title: true, description: true, address: true, city: true, country: true, photos: true, amenities: true, price: true, weekdayBasePrice: true, published: true, status: true, checkInInstructions: true, updatedAt: true },
      orderBy: { title: "asc" },
    });
    if (options.listingId && !listings.some((listing) => listing.id === options.listingId)) throw AppError.forbidden("You do not have access to this listing.");
    const scopedListings = options.listingId ? listings.filter((listing) => listing.id === options.listingId) : listings;
    const evaluated: HostOpportunityItem[] = [];

    for (const listing of scopedListings) {
      const detectedAt = listing.updatedAt.toISOString();
      const add = (input: Omit<HostOpportunityItem, "id" | "deduplicationKey" | "listingId" | "listingTitle" | "detectedAt" | "status"> & { ruleKey: string; evidenceFingerprint: string }) => {
        const deduplicationKey = `${listing.id}:${input.ruleKey}`;
        evaluated.push({ ...input, id: deduplicationKey, deduplicationKey, listingId: listing.id, listingTitle: listing.title, detectedAt, status: "ACTIVE" });
      };
      if (listing.photos.length === 0) add({ ruleKey: "listing.photos.missing", evidenceFingerprint: fingerprint("photos", 0), category: "LISTING_QUALITY", priority: "CRITICAL", title: "Upload listing photos", description: "This listing has no published photos.", evidence: "0 published photos; at least 5 are required for a complete gallery.", actionLabel: "Manage photos", actionHref: `/host/listings/${listing.id}/photos`, dismissible: false });
      else if (listing.photos.length < 5) add({ ruleKey: "listing.photos.insufficient", evidenceFingerprint: fingerprint("photos", listing.photos.length), category: "LISTING_QUALITY", priority: "HIGH", title: "Complete your photo gallery", description: "Add relevant, accurate photos so guests can review the space before booking.", evidence: `${listing.photos.length} published photo${listing.photos.length === 1 ? "" : "s"}; the listing gallery target is 5 or more.`, actionLabel: "Manage photos", actionHref: `/host/listings/${listing.id}/photos`, dismissible: true });
      if (!listing.description.trim()) add({ ruleKey: "listing.description.missing", evidenceFingerprint: fingerprint("description", false), category: "LISTING_QUALITY", priority: "HIGH", title: "Add a property description", description: "Guests need an accurate description of the space before they book.", evidence: "No property description is currently saved.", actionLabel: "Complete details", actionHref: `/host/listings/${listing.id}/description`, dismissible: false });
      if (!listing.address?.trim() || !listing.city?.trim() || !listing.country?.trim()) add({ ruleKey: "listing.location.incomplete", evidenceFingerprint: fingerprint("location", listing.address?.trim(), listing.city?.trim(), listing.country?.trim()), category: "LISTING_QUALITY", priority: "HIGH", title: "Complete your listing location", description: "Finish the location details required to describe where guests will stay.", evidence: "Address, city, or country is missing from the listing record.", actionLabel: "Complete location", actionHref: `/host/listings/${listing.id}/location`, dismissible: false });
      if (!listing.amenities.length) add({ ruleKey: "listing.amenities.empty", evidenceFingerprint: fingerprint("amenities", 0), category: "LISTING_QUALITY", priority: "MEDIUM", title: "List confirmed amenities", description: "Add only amenities that guests can actually use at this property.", evidence: "No amenities are currently published.", actionLabel: "Manage amenities", actionHref: `/host/listings/${listing.id}/amenities`, dismissible: true });
      const isPublished = listing.published && listing.status === "ACTIVE";
      if (isPublished && (listing.weekdayBasePrice ?? listing.price) <= 0) add({ ruleKey: "listing.pricing.missing", evidenceFingerprint: fingerprint("price", listing.weekdayBasePrice ?? listing.price), category: "PRICING_AVAILABILITY", priority: "HIGH", title: "Set a nightly price", description: "This active listing does not have a positive base nightly price.", evidence: "The saved base nightly price is 0 or unavailable.", actionLabel: "Review pricing", actionHref: `/host/listings/${listing.id}/pricing`, dismissible: false });
      if (isPublished && !listing.checkInInstructions?.trim()) add({ ruleKey: "listing.checkin.instructions_missing", evidenceFingerprint: fingerprint("checkin", false), category: "REVIEWS_GUEST_EXPERIENCE", priority: "MEDIUM", title: "Add check-in instructions", description: "Provide accurate arrival instructions for confirmed guests.", evidence: "No saved check-in instructions were found for this active listing.", actionLabel: "Add check-in guide", actionHref: `/host/listings/${listing.id}/check-in-out`, dismissible: true });
    }

    // Peer-based rules reuse Listing Performance, which already checks sample size, currency and exact stay dates.
    if (options.listingId) {
      const performance = await hostListingPerformanceService.getListingPerformance(actor, { listingId: options.listingId });
      for (const fix of performance?.quickFixes ?? []) {
        const deduplicationKey = `${performance!.listing.id}:${fix.id}`;
        evaluated.push({ id: deduplicationKey, ruleKey: fix.id, deduplicationKey, evidenceFingerprint: fingerprint(fix.id, fix.currentValueDescription, fix.recommendedChangeDescription), listingId: performance!.listing.id, listingTitle: performance!.listing.title, category: categoryForQuickFix[fix.category], priority: fix.priority, title: fix.title, description: fix.description, evidence: `${fix.currentValueDescription} ${fix.recommendedChangeDescription}`, actionLabel: fix.actionLabel, actionHref: fix.actionHref, dismissible: true, status: "ACTIVE", detectedAt: new Date().toISOString() });
      }
    }

    const lifecycle = await prisma.hostOpportunity.findMany({ where: { hostId: actor.id, ...(scopedListings.length ? { listingId: { in: scopedListings.map((listing) => listing.id) } } : { listingId: "__none__" }) }, orderBy: { updatedAt: "desc" } });
    const lifecycleByKey = new Map(lifecycle.map((record) => [record.deduplicationKey, record]));
    const now = new Date();
    const activeItems = evaluated.filter((item) => {
      const record = lifecycleByKey.get(item.deduplicationKey);
      if (!record || record.evidenceFingerprint !== item.evidenceFingerprint) return true;
      return !(record.status === "DISMISSED" || (record.status === "SNOOZED" && record.snoozedUntil && record.snoozedUntil > now));
    });
    const countsByCategory = emptyCounts();
    for (const item of activeItems) { countsByCategory.ALL += 1; countsByCategory[item.category] += 1; }
    const requestedStatus = options.status ?? "ACTIVE";
    const topPriorities = stableSort(activeItems, "PRIORITY").slice(0, 4);
    // On the default screen featured items intentionally live only in the Top
    // priority section. Filters remain exhaustive so a host can still locate
    // any active record by category, priority, listing, or sort.
    const defaultActiveQueue = (!options.category || options.category === "ALL") && !options.priority && (options.sort ?? "PRIORITY") === "PRIORITY";
    let filtered: HostOpportunityItem[] = requestedStatus === "ACTIVE"
      ? (defaultActiveQueue ? activeItems.filter((item) => !topPriorities.some((top) => top.id === item.id)) : activeItems)
      : lifecycle.filter((record) => record.status === requestedStatus).map((record) => snapshotItem(record.evidenceSnapshot)).filter((item): item is HostOpportunityItem => Boolean(item)).map((item) => ({ ...item, status: requestedStatus, snoozedUntil: lifecycleByKey.get(item.deduplicationKey)?.snoozedUntil?.toISOString() ?? null }));
    if (options.category && options.category !== "ALL") filtered = filtered.filter((item) => item.category === options.category);
    if (options.priority) filtered = filtered.filter((item) => item.priority === options.priority);
    const sorted = stableSort(filtered, options.sort ?? "PRIORITY");
    const pageSize = Math.min(12, Math.max(1, options.pageSize ?? 10));
    const totalCount = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.min(Math.max(1, options.page ?? 1), totalPages);
    return {
      selectedListingId: options.listingId ?? null,
      listings: listings.map((listing) => ({ id: listing.id, title: listing.title })),
      summary: { activeCount: activeItems.length, highPriorityCount: activeItems.filter((item) => item.priority === "CRITICAL" || item.priority === "HIGH").length, listingsNeedingAttentionCount: new Set(activeItems.map((item) => item.listingId)).size, resolvedCount: lifecycle.filter((record) => record.status === "RESOLVED").length },
      topPriorities,
      opportunities: { items: sorted.slice((page - 1) * pageSize, page * pageSize), totalCount, page, pageSize, totalPages, countsByCategory },
    };
  },

  async updateLifecycle(actor: AuthUser, input: { opportunityId: string; listingId: string; action: "DISMISS" | "SNOOZE"; snoozedUntil?: Date }) {
    const overview = await this.getOpportunitiesOverview(actor, { listingId: input.listingId, pageSize: 12 });
    const opportunity = [...overview.topPriorities, ...overview.opportunities.items].find((item) => item.id === input.opportunityId);
    if (!opportunity) throw AppError.notFound("This opportunity is no longer active.");
    if (!opportunity.dismissible) throw AppError.forbidden("This required opportunity cannot be changed.");
    if (input.action === "SNOOZE" && (!input.snoozedUntil || input.snoozedUntil <= new Date())) throw AppError.validation("Choose a future time to snooze this opportunity.");
    const status = input.action === "DISMISS" ? "DISMISSED" : "SNOOZED";
    const now = new Date();
    await prisma.hostOpportunity.upsert({
      where: { hostId_deduplicationKey: { hostId: actor.id, deduplicationKey: opportunity.deduplicationKey } },
      create: { hostId: actor.id, listingId: opportunity.listingId, ruleKey: opportunity.ruleKey, deduplicationKey: opportunity.deduplicationKey, status, evidenceFingerprint: opportunity.evidenceFingerprint, evidenceSnapshot: opportunity as unknown as Prisma.InputJsonValue, actionHref: opportunity.actionHref, detectedAt: new Date(opportunity.detectedAt), lastEvaluatedAt: now, ...(status === "DISMISSED" ? { dismissedAt: now } : { snoozedUntil: input.snoozedUntil }) },
      update: { status, evidenceFingerprint: opportunity.evidenceFingerprint, evidenceSnapshot: opportunity as unknown as Prisma.InputJsonValue, actionHref: opportunity.actionHref, lastEvaluatedAt: now, ...(status === "DISMISSED" ? { dismissedAt: now, snoozedUntil: null } : { snoozedUntil: input.snoozedUntil, dismissedAt: null }) },
    });
    return { success: true, opportunityId: opportunity.id, status, snoozedUntil: input.snoozedUntil?.toISOString() ?? null };
  },
};
