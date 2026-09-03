"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions/authorize";
import { prisma } from "@/lib/db/prisma";
import { Role, ListingStatus } from "@/generated/prisma/enums";
import { auditService } from "@/services/audit.service";
import { listingService } from "@/services/listing.service";

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
    assertRole(actor, [Role.ADMIN]);

    const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
    if (!listing) throw AppError.notFound("Listing not found.");

    const updated = await prisma.listing.update({
      where: { id: input.listingId },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.description !== undefined && { description: input.description.trim() }),
        ...(input.hostingType !== undefined && { hostingType: input.hostingType as any }),
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
      },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email || "",
      action: "ADMIN_LISTING_UPDATED",
      resourceType: "Listing",
      resourceId: updated.id,
      description: `Admin updated property details for listing ${updated.title} (${updated.id})`,
    });

    revalidatePath("/admin/listings");
    return updated;
  });
}

/**
 * 2. Admin Update Pricing & Fees
 */
export async function adminUpdateListingPricingAction(input: {
  listingId: string;
  price: number; // in cents
  cleaningFee?: number;
  securityDeposit?: number;
  weekendPrice?: number;
}) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);

    const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
    if (!listing) throw AppError.notFound("Listing not found.");

    const updated = await prisma.listing.update({
      where: { id: input.listingId },
      data: {
        price: Math.max(0, Math.round(input.price)),
        ...(input.cleaningFee !== undefined && { cleaningFee: Math.max(0, Math.round(input.cleaningFee)) }),
        ...(input.securityDeposit !== undefined && { securityDeposit: Math.max(0, Math.round(input.securityDeposit)) }),
        ...(input.weekendPrice !== undefined && { weekendPrice: input.weekendPrice ? Math.max(0, Math.round(input.weekendPrice)) : null }),
      },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email || "",
      action: "ADMIN_LISTING_PRICING_UPDATED",
      resourceType: "Listing",
      resourceId: updated.id,
      description: `Admin updated pricing for listing ${updated.title} (${updated.id}) to $${(updated.price / 100).toFixed(2)}`,
    });

    revalidatePath("/admin/listings");
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
    assertRole(actor, [Role.ADMIN]);

    const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
    if (!listing) throw AppError.notFound("Listing not found.");

    const updated = await prisma.listing.update({
      where: { id: input.listingId },
      data: {
        isPaused: input.isPaused,
        published: input.isPaused ? false : listing.published,
      },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email || "",
      action: input.isPaused ? "ADMIN_LISTING_DISABLED" : "ADMIN_LISTING_ENABLED",
      resourceType: "Listing",
      resourceId: updated.id,
      description: `Admin ${input.isPaused ? "disabled/paused" : "enabled"} listing ${updated.title} (${updated.id})`,
    });

    revalidatePath("/admin/listings");
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
    assertRole(actor, [Role.ADMIN]);

    const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
    if (!listing) throw AppError.notFound("Listing not found.");

    const updated = await prisma.listing.update({
      where: { id: input.listingId },
      data: {
        isFeatured: input.isFeatured,
      },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email || "",
      action: input.isFeatured ? "ADMIN_LISTING_FEATURED" : "ADMIN_LISTING_UNFEATURED",
      resourceType: "Listing",
      resourceId: updated.id,
      description: `Admin ${input.isFeatured ? "featured" : "unfeatured"} property ${updated.title} (${updated.id})`,
    });

    revalidatePath("/admin/listings");
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
    assertRole(actor, [Role.ADMIN]);

    const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
    if (!listing) throw AppError.notFound("Listing not found.");

    const updated = await prisma.listing.update({
      where: { id: input.listingId },
      data: {
        ...(input.published !== undefined && { published: input.published }),
        ...(input.showExactLocation !== undefined && { showExactLocation: input.showExactLocation }),
        ...(input.published === true && { status: ListingStatus.ACTIVE, isPaused: false }),
      },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email || "",
      action: "ADMIN_LISTING_VISIBILITY_UPDATED",
      resourceType: "Listing",
      resourceId: updated.id,
      description: `Admin updated visibility for listing ${updated.title} (Published: ${updated.published})`,
    });

    revalidatePath("/admin/listings");
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
    assertRole(actor, [Role.ADMIN]);

    const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
    if (!listing) throw AppError.notFound("Listing not found.");

    let status: ListingStatus;
    let published = listing.published;
    let rejectionReason = listing.rejectionReason;

    if (input.action === "APPROVE") {
      status = ListingStatus.APPROVED;
      published = true;
      rejectionReason = null;
    } else if (input.action === "REQUEST_CHANGES") {
      status = ListingStatus.CHANGES_REQUESTED;
      published = false;
      rejectionReason = input.reason || "Quality moderation feedback: Changes requested by Admin.";
    } else {
      status = ListingStatus.REJECTED;
      published = false;
      rejectionReason = input.reason || "Quality moderation feedback: Listing rejected by Admin.";
    }

    const updated = await prisma.listing.update({
      where: { id: input.listingId },
      data: {
        status,
        published,
        rejectionReason,
        reviewerId: actor.id,
        ...(input.action === "APPROVE" && { approvedAt: new Date(), approvedById: actor.id }),
      },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email || "",
      action: `ADMIN_LISTING_MODERATED_${input.action}`,
      resourceType: "Listing",
      resourceId: updated.id,
      description: `Admin quality moderation for listing ${updated.title}: ${input.action} (${rejectionReason || "No note"})`,
    });

    revalidatePath("/admin/listings");
    return updated;
  });
}

/**
 * 7. Admin Delete Listing
 */
export async function adminDeleteListingAction(input: { listingId: string }) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);

    const result = await listingService.remove(actor, input.listingId);

    revalidatePath("/admin/listings");
    revalidatePath("/host/listings");
    revalidatePath("/admin/hosts");
    return result;
  });
}
