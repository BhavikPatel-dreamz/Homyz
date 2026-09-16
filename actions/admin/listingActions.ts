"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions/authorize";
import { assertPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { HostingType, Role, ListingStatus } from "@/generated/prisma/enums";
import { auditService } from "@/services/audit.service";
import { listingService } from "@/services/listing.service";
import { invalidateListingCache } from "@/lib/redis/invalidation";
import { formatSarFromHalalas } from "@/lib/currency";
import type { AuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { userService } from "@/services/user.service";
import { updateHostPublicProfileSchema } from "@/lib/validation/host-profile";

function revalidateListingLifecycle(id: string, customSlug?: string | null) {
  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
  revalidatePath("/host/listings");
  revalidatePath(`/host/listings/${id}`);
  revalidatePath(`/listings/${id}`);
  if (customSlug) revalidatePath(`/stay/${customSlug}`);
}

function assertAdminListingPermission(
  actor: AuthUser | null,
  permission: string,
): asserts actor is AuthUser {
  assertRole(actor, [Role.ADMIN]);
  assertPermission(actor, permission);
}

async function invalidateListingPublicCache(id: string) {
  await invalidateListingCache(id);
}

/**
 * 1. Admin Edit Property Details
 */
export async function adminUpdateListingDetailsAction(input: {
  listingId: string;
  title?: string;
  description?: string;
  propertyType?: string;
  listingType?: string;
  hostingType?: string;
  address?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  country?: string;
  guests?: number;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  photos?: string[];
  amenities?: string[];
  houseRules?: string[];
  highlights?: string[];
  safetyDisclosures?: string[];
  checkInMethod?: string;
  checkInStart?: string;
  checkInEnd?: string;
  checkOutTime?: string;
  cancellationPolicy?: string;
  instantBook?: boolean;
  minNights?: number;
  maxNights?: number;
  blockedDates?: string[];
}) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertAdminListingPermission(actor, PERMISSIONS.LISTINGS_EDIT);

    const listing = await listingService.getAdminListingForUpdate(input.listingId);
    if (!listing) throw AppError.notFound("Listing not found.");
    if (input.hostingType !== undefined && !Object.values(HostingType).includes(input.hostingType as HostingType)) {
      throw AppError.badRequest("Invalid hosting type.");
    }

    const updated = await listingService.updateForAdmin(input.listingId, {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.description !== undefined && { description: input.description.trim() }),
        ...(input.hostingType !== undefined && { hostingType: input.hostingType as HostingType }),
        ...(input.propertyType !== undefined && { propertyType: input.propertyType.trim() }),
        ...(input.listingType !== undefined && { listingType: input.listingType.trim() }),
        ...(input.address !== undefined && { address: input.address.trim() }),
        ...(input.city !== undefined && { city: input.city.trim() }),
        ...(input.district !== undefined && { district: input.district.trim() }),
        ...(input.postalCode !== undefined && { postalCode: input.postalCode.trim() }),
        ...(input.country !== undefined && { country: input.country.trim() }),
        ...(input.guests !== undefined && { guests: Number(input.guests) }),
        ...(input.bedrooms !== undefined && { bedrooms: Number(input.bedrooms) }),
        ...(input.beds !== undefined && { beds: Number(input.beds) }),
        ...(input.bathrooms !== undefined && { bathrooms: Number(input.bathrooms) }),
        ...(input.photos !== undefined && { photos: input.photos }),
        ...(input.amenities !== undefined && { amenities: input.amenities }),
        ...(input.houseRules !== undefined && { houseRules: input.houseRules }),
        ...(input.highlights !== undefined && { highlights: input.highlights }),
        ...(input.safetyDisclosures !== undefined && { safetyDisclosures: input.safetyDisclosures }),
        ...(input.checkInMethod !== undefined && { checkInMethod: input.checkInMethod.trim() }),
        ...(input.checkInStart !== undefined && { checkInStart: input.checkInStart.trim() }),
        ...(input.checkInEnd !== undefined && { checkInEnd: input.checkInEnd.trim() }),
        ...(input.checkOutTime !== undefined && { checkOutTime: input.checkOutTime.trim() }),
        ...(input.cancellationPolicy !== undefined && { cancellationPolicy: input.cancellationPolicy.trim() }),
        ...(input.instantBook !== undefined && { instantBook: Boolean(input.instantBook) }),
        ...(input.minNights !== undefined && { minNights: Number(input.minNights) }),
        ...(input.maxNights !== undefined && { maxNights: Number(input.maxNights) }),
        ...(input.blockedDates !== undefined && { blockedDates: input.blockedDates }),
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email || "",
      action: "ADMIN_LISTING_UPDATED",
      resourceType: "Listing",
      resourceId: updated.id,
      description: `Admin updated property details for listing ${updated.title} (${updated.id})`,
    });

    await invalidateListingPublicCache(updated.id);
    revalidateListingLifecycle(updated.id, updated.customSlug);
    return updated;
  });
}

/**
 * 2. Admin Update Pricing & Fees
 */
export async function adminUpdateListingPricingAction(input: {
  listingId: string;
  price: number; // in cents
  weekdayBasePrice?: number;
  cleaningFee?: number;
  securityDeposit?: number;
  weekendPrice?: number;
  extraGuestFee?: number;
}) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertAdminListingPermission(actor, PERMISSIONS.LISTINGS_EDIT);

    const listing = await listingService.getAdminListingForUpdate(input.listingId);
    if (!listing) throw AppError.notFound("Listing not found.");

    const effectiveWeekday = Math.max(0, Math.round(input.weekdayBasePrice ?? input.price));

    const updated = await listingService.updateForAdmin(input.listingId, {
        price: effectiveWeekday,
        weekdayBasePrice: effectiveWeekday,
        ...(input.cleaningFee !== undefined && { cleaningFee: Math.max(0, Math.round(input.cleaningFee)) }),
        ...(input.securityDeposit !== undefined && { securityDeposit: Math.max(0, Math.round(input.securityDeposit)) }),
        ...(input.weekendPrice !== undefined && { weekendPrice: input.weekendPrice ? Math.max(0, Math.round(input.weekendPrice)) : null }),
        ...(input.extraGuestFee !== undefined && { extraGuestFee: Math.max(0, Math.round(input.extraGuestFee)) }),
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email || "",
      action: "ADMIN_LISTING_PRICING_UPDATED",
      resourceType: "Listing",
      resourceId: updated.id,
      description: `Admin updated pricing for listing ${updated.title} (${updated.id}) to ${formatSarFromHalalas(updated.price)}`,
    });

    await invalidateListingPublicCache(updated.id);
    revalidateListingLifecycle(updated.id, updated.customSlug);
    return updated;
  });
}

/**
 * 3. Admin Disable / Pause / Enable Listing
 */
export async function adminToggleDisableListingAction(input: {
  listingId: string;
  isPaused: boolean;
}) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertAdminListingPermission(actor, PERMISSIONS.LISTINGS_SUSPEND);

    const listing = await listingService.getAdminListingForUpdate(input.listingId);
    if (!listing) throw AppError.notFound("Listing not found.");

    const updated = await listingService.updateForAdmin(input.listingId, {
        isPaused: input.isPaused,
        published: input.isPaused ? false : listing.published,
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email || "",
      action: input.isPaused ? "ADMIN_LISTING_DISABLED" : "ADMIN_LISTING_ENABLED",
      resourceType: "Listing",
      resourceId: updated.id,
      description: `Admin ${input.isPaused ? "disabled/paused" : "enabled"} listing ${updated.title} (${updated.id})`,
    });

    await invalidateListingPublicCache(updated.id);
    revalidateListingLifecycle(updated.id, updated.customSlug);
    return updated;
  });
}

/**
 * 4. Admin Feature / Unfeature Property
 */
export async function adminToggleFeatureListingAction(input: {
  listingId: string;
  isFeatured: boolean;
}) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertAdminListingPermission(actor, PERMISSIONS.LISTINGS_EDIT);

    const listing = await listingService.getAdminListingForUpdate(input.listingId);
    if (!listing) throw AppError.notFound("Listing not found.");

    const updated = await listingService.updateForAdmin(input.listingId, {
        isFeatured: input.isFeatured,
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email || "",
      action: input.isFeatured ? "ADMIN_LISTING_FEATURED" : "ADMIN_LISTING_UNFEATURED",
      resourceType: "Listing",
      resourceId: updated.id,
      description: `Admin ${input.isFeatured ? "featured" : "unfeatured"} property ${updated.title} (${updated.id})`,
    });

    await invalidateListingPublicCache(updated.id);
    revalidateListingLifecycle(updated.id, updated.customSlug);
    return updated;
  });
}

/**
 * 5. Admin Manage Visibility
 */
export async function adminToggleVisibilityAction(input: {
  listingId: string;
  published?: boolean;
  showExactLocation?: boolean;
}) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertAdminListingPermission(actor, PERMISSIONS.LISTINGS_APPROVE);

    const listing = await listingService.getAdminListingForUpdate(input.listingId);
    if (!listing) throw AppError.notFound("Listing not found.");
    if (input.published === true && listing.status !== ListingStatus.ACTIVE) {
      throw AppError.badRequest("Approve a submitted listing before making it public.");
    }

    const updated = await listingService.updateForAdmin(input.listingId, {
        ...(input.published !== undefined && { published: input.published }),
        ...(input.showExactLocation !== undefined && { showExactLocation: input.showExactLocation }),
        ...(input.published === true && { status: ListingStatus.ACTIVE, isPaused: false }),
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email || "",
      action: "ADMIN_LISTING_VISIBILITY_UPDATED",
      resourceType: "Listing",
      resourceId: updated.id,
      description: `Admin updated visibility for listing ${updated.title} (Published: ${updated.published})`,
    });

    await invalidateListingPublicCache(updated.id);
    revalidateListingLifecycle(updated.id, updated.customSlug);
    return updated;
  });
}

/**
 * 6. Admin Moderate Listing Quality (Approve / Request Changes / Reject)
 */
export async function adminModerateListingQualityAction(input: {
  listingId: string;
  action: "APPROVE" | "REQUEST_CHANGES" | "REJECT";
  reason?: string;
}) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertAdminListingPermission(actor, PERMISSIONS.LISTINGS_APPROVE);

    let updated;
    if (input.action === "APPROVE") {
      updated = await listingService.approveListingByAdmin(actor, input.listingId);
    } else if (input.action === "REQUEST_CHANGES") {
      updated = await listingService.requestChangesByAdmin(
        actor,
        input.listingId,
        input.reason?.trim() || "Please correct the requested listing details and resubmit.",
      );
    } else {
      const reason = input.reason?.trim();
      if (!reason) throw AppError.badRequest("A rejection reason is required.");
      updated = await listingService.rejectListingByAdmin(actor, input.listingId, reason);
    }

    revalidateListingLifecycle(updated.id, updated.customSlug);
    return updated;
  });
}

/**
 * 7. Admin Delete Listing
 */
export async function adminDeleteListingAction(input: { listingId: string }) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertAdminListingPermission(actor, PERMISSIONS.LISTINGS_DELETE);

    const result = await listingService.remove(actor, input.listingId);

    revalidatePath("/admin/listings");
    revalidatePath("/host/listings");
    revalidatePath("/admin/hosts");
    return result;
  });
}

/** Listing-scoped audit feed. Keeps long histories paginated and never returns metadata. */
export async function getAdminListingAuditHistoryAction(input: { listingId: string; page?: number; pageSize?: number }) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertAdminListingPermission(actor, PERMISSIONS.LISTINGS_VIEW);
    const pageSize = Math.min(25, Math.max(5, Math.floor(input.pageSize ?? 10)));
    const page = Math.max(1, Math.floor(input.page ?? 1));
    const { items, total } = await auditService.listForResource("Listing", input.listingId, {
      page,
      limit: pageSize,
    });
    return {
      items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  });
}

/**
 * 8. Admin Update Listing Host Public Profile
 */
export async function adminUpdateListingHostProfileAction(input: {
  listingId: string;
  profile: unknown;
}) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertAdminListingPermission(actor, PERMISSIONS.LISTINGS_EDIT);

    const listing = await prisma.listing.findUnique({
      where: { id: input.listingId },
      select: { id: true, title: true, hostId: true, customSlug: true },
    });
    if (!listing) throw AppError.notFound("Listing not found");

    const validatedInput = updateHostPublicProfileSchema.parse(input.profile);
    const updatedUser = await userService.updateHostPublicProfile(listing.hostId, validatedInput);

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email || "",
      action: "ADMIN_UPDATE_HOST_PROFILE",
      resourceType: "Listing",
      resourceId: listing.id,
      description: `Admin updated host profile for listing ${listing.title} (${listing.id})`,
    });

    revalidateListingLifecycle(listing.id, listing.customSlug);
    revalidatePath(`/host/listings/${listing.id}`);
    revalidatePath(`/admin/listings/${listing.id}`);
    revalidatePath("/profile");
    revalidatePath("/profile-management");

    return updatedUser.publicProfile as Record<string, unknown>;
  });
}

