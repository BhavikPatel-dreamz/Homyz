"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions/authorize";
import {
  createListingSchema,
  updateListingSchema,
} from "@/lib/validation/listing";
import { listingService } from "@/services/listing.service";
import { Role } from "@/generated/prisma/enums";

export async function createListingAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const data = createListingSchema.parse(input);
    const listing = await listingService.create(actor, data);
    revalidatePath("/host/listings");
    return listing;
  });
}

export async function updateListingAction(id: string, input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const data = updateListingSchema.parse(input);
    // Ownership (host must own; ADMIN bypasses) is enforced in the service.
    const listing = await listingService.update(actor, id, data);
    revalidatePath("/host/listings");
    return listing;
  });
}

export async function deleteListingAction(
  id: string,
  feedback?: {
    categories?: string[];
    reasons?: string[];
    customFeedback?: string;
  }
) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const result = await listingService.remove(actor, id, feedback);
    revalidatePath("/host/listings");
    revalidatePath("/admin/listings");
    revalidatePath("/admin/hosts");
    return result;
  });
}

export async function publishListingAction(id: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const listing = await listingService.publish(actor, id);
    revalidatePath("/host/listings");
    revalidatePath(`/host/listings/${id}`);
    revalidatePath(`/listings/${id}`);
    if (listing.customSlug) {
      revalidatePath(`/stay/${listing.customSlug}`);
    }
    return listing;
  });
}

export async function unpublishListingAction(id: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const listing = await listingService.unpublish(actor, id);
    revalidatePath("/host/listings");
    revalidatePath(`/host/listings/${id}`);
    revalidatePath(`/listings/${id}`);
    if (listing.customSlug) {
      revalidatePath(`/stay/${listing.customSlug}`);
    }
    return listing;
  });
}

export async function submitListingForReviewAction(id: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const listing = await listingService.submitForReview(actor, id);
    revalidatePath("/host/listings");
    return listing;
  });
}

export async function resubmitListingForReviewAction(id: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const listing = await listingService.resubmitForReview(actor, id);
    revalidatePath("/host/listings");
    return listing;
  });
}

export async function approveListingByAdminAction(id: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    const listing = await listingService.approveListingByAdmin(actor, id);
    revalidatePath("/admin/hosts");
    revalidatePath("/host/listings");
    return listing;
  });
}

export async function requestListingChangesByAdminAction(id: string, requestedChanges: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    const listing = await listingService.requestChangesByAdmin(actor, id, requestedChanges);
    revalidatePath("/admin/hosts");
    revalidatePath("/host/listings");
    return listing;
  });
}

export async function rejectListingByAdminAction(id: string, reason: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    const listing = await listingService.rejectListingByAdmin(actor, id, reason);
    revalidatePath("/admin/hosts");
    revalidatePath("/host/listings");
    return listing;
  });
}

export async function duplicateListingAction(id: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const listing = await listingService.duplicate(actor, id);
    revalidatePath("/host/listings");
    return listing;
  });
}

export async function togglePauseListingAction(id: string, isPaused: boolean) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const listing = await listingService.togglePause(actor, id, isPaused);
    revalidatePath("/host/listings");
    revalidatePath("/admin/hosts");
    return listing;
  });
}

export async function updateListingAvailabilityAction(id: string, blockedDates: string[]) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const listing = await listingService.updateAvailability(actor, id, blockedDates);
    revalidatePath("/host/listings");
    return listing;
  });
}

